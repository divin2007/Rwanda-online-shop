import { Injectable, NotFoundException, BadRequestException, ConflictException, forwardRef, Inject } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { LocationService, RouteService, Coordinates } from '@rmf/location';
import { DeliveryStatus } from '@rmf/shared-types';
import { StateConflictError } from '@rmf/shared-utils';
import { DeliveryGateway } from './delivery.gateway';

const DELIVERY_TRANSITIONS: Record<string, string[]> = {
  [DeliveryStatus.ASSIGNED]: [DeliveryStatus.EN_ROUTE_TO_PICKUP, DeliveryStatus.FAILED],
  [DeliveryStatus.EN_ROUTE_TO_PICKUP]: [DeliveryStatus.PENDING_HANDOVER, DeliveryStatus.FAILED],
  [DeliveryStatus.PENDING_HANDOVER]: [DeliveryStatus.PICKED_UP, DeliveryStatus.FAILED],
  [DeliveryStatus.PICKED_UP]: [DeliveryStatus.EN_ROUTE_TO_DROPOFF, DeliveryStatus.DELIVERED, DeliveryStatus.FAILED],
  [DeliveryStatus.EN_ROUTE_TO_DROPOFF]: [DeliveryStatus.DELIVERED, DeliveryStatus.FAILED],
  [DeliveryStatus.DELIVERED]: [],
  [DeliveryStatus.FAILED]: []
};
const MANUAL_REBROADCAST_WAIT_MS = 5 * 60 * 1000;

@Injectable()
export class DeliveryService {
  private locationService: LocationService;
  private routeService: RouteService;
  private readonly dispatchTimers = new Map<string, NodeJS.Timeout>();

  constructor(
    @InjectModel('Delivery') private deliveryModel: Model<any>,
    @InjectModel('RiderProfile') private riderModel: Model<any>,
    @InjectModel('Transaction') private orderModel: Model<any>,
    @Inject(forwardRef(() => DeliveryGateway))
    private readonly deliveryGateway: DeliveryGateway
  ) {
    this.locationService = new LocationService();
    this.routeService = new RouteService();
  }

  private normalizeId(value: any): string | null {
    if (value === null || value === undefined) return null;
    if (typeof value === 'string') return value;
    if (typeof value === 'number') return String(value);
    if (typeof value.toHexString === 'function') return value.toHexString();
    if (value._id !== undefined && value._id !== value) return this.normalizeId(value._id);
    if (value.id !== undefined && value.id !== value) return this.normalizeId(value.id);
    return String(value);
  }

  private validateTransition(currentStatus: string, newStatus: string): void {
    if (currentStatus === newStatus) return;
    const allowed = DELIVERY_TRANSITIONS[currentStatus];
    if (!allowed || !allowed.includes(newStatus)) {
      throw new StateConflictError(`Forbidden delivery transition: ${currentStatus} -> ${newStatus}`);
    }
  }

  async getDeliveryById(id: string): Promise<any> {
    const delivery = await this.deliveryModel.findById(id).exec();
    if (!delivery) throw new NotFoundException('Delivery not found');
    return delivery;
  }

  async canUserViewDelivery(delivery: any, userId: string, role?: string): Promise<boolean> {
    const actorId = this.normalizeId(userId);
    const normalizedRole = String(role || '').toUpperCase();
    if (!actorId) return false;
    if (normalizedRole === 'ADMIN') return true;

    const riderUserId = this.normalizeId(delivery?.rider?.userId);
    if (normalizedRole === 'RIDER' && riderUserId && riderUserId === actorId) {
      return true;
    }

    const orderId = this.normalizeId(delivery?.orderId);
    if (!orderId) return false;

    const order = await this.orderModel
      .findById(orderId)
      .select('buyer buyerId seller sellerUserId')
      .lean()
      .exec();
    if (!order) return false;

    const buyerId = this.normalizeId(order.buyer?.userId || order.buyerId);
    const sellerId = this.normalizeId(order.seller?.userId || order.sellerUserId);

    if (normalizedRole === 'BUYER') return Boolean(buyerId && buyerId === actorId);
    if (normalizedRole === 'SELLER') return Boolean(sellerId && sellerId === actorId);
    return Boolean((buyerId && buyerId === actorId) || (sellerId && sellerId === actorId));
  }

  async calculateDeliveryFee(from: Coordinates, to: Coordinates, weightFactor: number = 1): Promise<{ fee: number, route: any }> {
    const route = await this.routeService.getOptimizedRoute(from, to);
    
    // Tiered pricing: 500 RWF per 5km block
    // 0-5km = 500, 5-10km = 1000, 10-15km = 1500...
    const fee = Math.ceil(route.distanceKm / 5) * 500;

    return { fee, route };
  }

  private async syncOrderDeliveryFee(orderId: any, deliveryFee: number, searchSurcharge: number, radiusMeters: number) {
    if (!orderId) return;
    try {
      const axios = require('axios');
      const orderUrl = process.env.ORDER_SERVICE_URL || 'http://localhost:3006/api/v1';
      const internalSecret = process.env.INTERNAL_SERVICE_SECRET;
      await axios.patch(
        `${orderUrl}/orders/${orderId}/delivery-dispatch-fee`,
        {
          deliveryFee,
          searchSurcharge,
          radiusMeters,
          userId: 'delivery-service',
        },
        {
          headers: internalSecret ? { 'x-internal-service-key': internalSecret } : {},
          timeout: 2500,
        }
      );
    } catch (error: any) {
      console.error(`Failed to sync adaptive delivery fee to order ${orderId}:`, error?.response?.data || error?.message);
    }
  }

  private clearDispatchTimer(deliveryId: string) {
    const timer = this.dispatchTimers.get(deliveryId);
    if (timer) clearTimeout(timer);
    this.dispatchTimers.delete(deliveryId);
  }

  private scheduleAdaptiveBroadcast(deliveryId: string, delayMs = 0) {
    this.clearDispatchTimer(deliveryId);
    const timer = setTimeout(() => {
      this.runAdaptiveBroadcast(deliveryId).catch(err => console.error('Adaptive rider broadcast failed', err));
    }, delayMs);
    this.dispatchTimers.set(deliveryId, timer);
  }

  private getDispatchConfig() {
    const initialRadiusMeters = Number(process.env.RIDER_DISPATCH_INITIAL_RADIUS_METERS || 150);
    const closeRangeStepMeters = Number(process.env.RIDER_DISPATCH_CLOSE_STEP_METERS || 50);
    const farRangeStepMeters = Number(process.env.RIDER_DISPATCH_FAR_STEP_METERS || 500);
    const closeRangeLimitMeters = Number(process.env.RIDER_DISPATCH_CLOSE_LIMIT_METERS || 1000);
    const maxRadiusMeters = Number(process.env.RIDER_DISPATCH_MAX_RADIUS_METERS || 16000);
    return {
      initialRadiusMeters,
      closeRangeStepMeters,
      farRangeStepMeters,
      closeRangeLimitMeters,
      maxRadiusMeters,
    };
  }

  private getNextDispatchRadius(currentRadiusMeters: number): number {
    const config = this.getDispatchConfig();
    const step = currentRadiusMeters < config.closeRangeLimitMeters
      ? config.closeRangeStepMeters
      : config.farRangeStepMeters;
    return Math.min(currentRadiusMeters + step, config.maxRadiusMeters);
  }

  private calculateDispatchSearchSurcharge(radiusMeters: number): number {
    if (radiusMeters < 1000) return 0;
    if (radiusMeters < 8000) return 500;
    if (radiusMeters <= 16000) return 800;
    const extraBlocks = Math.ceil((radiusMeters - 16000) / 8000);
    return 800 + (extraBlocks * 800);
  }

  private async runAdaptiveBroadcast(deliveryId: string) {
    const delivery = await this.deliveryModel.findById(deliveryId);
    if (!delivery) {
      this.clearDispatchTimer(deliveryId);
      return;
    }

    const hasAssignedRider = Boolean(delivery.rider?.riderId);
    if (hasAssignedRider || delivery.status !== DeliveryStatus.ASSIGNED) {
      this.clearDispatchTimer(deliveryId);
      return;
    }

    const coords = delivery.pickup?.coordinates;
    if (!coords || !Number.isFinite(coords.lat) || !Number.isFinite(coords.lng)) {
      this.clearDispatchTimer(deliveryId);
      return;
    }

    const baseDeliveryFee = Number(
      delivery.financials?.baseDeliveryFee
      || delivery.financials?.deliveryFee
      || process.env.MIN_DELIVERY_FEE
      || 500
    );

    const config = this.getDispatchConfig();
    const currentRadiusMeters = Number(
      delivery.dispatch?.nextRadiusMeters
      || delivery.dispatch?.currentRadiusMeters
      || config.initialRadiusMeters
    );
    const boundedRadiusMeters = Math.min(Math.max(currentRadiusMeters, config.initialRadiusMeters), config.maxRadiusMeters);
    const nextRadiusMeters = this.getNextDispatchRadius(boundedRadiusMeters);
    const searchSurcharge = this.calculateDispatchSearchSurcharge(boundedRadiusMeters);
    const deliveryFee = baseDeliveryFee + searchSurcharge;
    const payload = delivery.toObject ? delivery.toObject() : delivery;
    const result = this.deliveryGateway.broadcastToActiveRiders(payload, coords.lat, coords.lng, {
      searchSurcharge,
      deliveryFee,
      radiusMeters: boundedRadiusMeters,
      nextRadiusMeters,
      maxRadiusMeters: config.maxRadiusMeters,
      strategy: 'PROGRESSIVE_RADIUS',
    });

    const existingNotified = new Set((delivery.dispatch?.notifiedRiderIds || []).map((id: any) => String(id)));
    const newRiderIds = result.riderIds.filter(id => !existingNotified.has(String(id)));

    await this.deliveryModel.findByIdAndUpdate(deliveryId, {
      $set: {
        'financials.baseDeliveryFee': baseDeliveryFee,
        'financials.deliveryFee': deliveryFee,
        'financials.searchSurcharge': searchSurcharge,
        'dispatch.strategy': 'PROGRESSIVE_RADIUS',
        'dispatch.initialRadiusMeters': config.initialRadiusMeters,
        'dispatch.currentRadiusMeters': boundedRadiusMeters,
        'dispatch.nextRadiusMeters': nextRadiusMeters,
        'dispatch.stepMeters': boundedRadiusMeters < config.closeRangeLimitMeters ? config.closeRangeStepMeters : config.farRangeStepMeters,
        'dispatch.maxRadiusMeters': config.maxRadiusMeters,
        'dispatch.lastBroadcastAt': new Date(),
      },
      $inc: { 'dispatch.broadcastCount': 1 },
      ...(newRiderIds.length ? { $addToSet: { 'dispatch.notifiedRiderIds': { $each: newRiderIds } } } : {}),
    });

    if (
      searchSurcharge !== Number(delivery.financials?.searchSurcharge || 0)
      || deliveryFee !== Number(delivery.financials?.deliveryFee || 0)
      || boundedRadiusMeters !== Number(delivery.dispatch?.currentRadiusMeters || 0)
    ) {
      this.syncOrderDeliveryFee(delivery.orderId, deliveryFee, searchSurcharge, boundedRadiusMeters).catch(() => {});
    }

    for (const riderId of newRiderIds) {
      this.triggerNotification(riderId, 'order.placed', {
        orderNumber: delivery.orderNumber,
        orderId: delivery.orderId,
        referenceId: delivery._id,
        referenceType: 'Delivery',
        broadcastMode: 'PROGRESSIVE_RADIUS',
        radiusMeters: boundedRadiusMeters,
        nextRadiusMeters,
        searchSurcharge,
        deliveryFee,
      });
    }

    if (delivery.status === DeliveryStatus.ASSIGNED && !delivery.rider?.riderId) {
      this.scheduleAdaptiveBroadcast(deliveryId, Number(process.env.RIDER_BROADCAST_INTERVAL_MS || 10000));
    } else {
      this.clearDispatchTimer(deliveryId);
    }
  }

  async createDelivery(data: any): Promise<any> {
    const existing = await this.deliveryModel.findOne({ orderId: data.orderId });
    if (existing) {
      throw new ConflictException('Delivery already exists for this order');
    }

    // Calculate route if missing
    let route = data.route;
    if (!route && data.pickup?.coordinates && data.dropoff?.coordinates) {
      try {
        const routeData = await this.routeService.getOptimizedRoute(
          data.pickup.coordinates,
          data.dropoff.coordinates
        );
        route = {
          distanceKm: routeData.distanceKm,
          estimatedMinutes: routeData.estimatedMinutes,
          geometry: routeData.geometry
        };
      } catch (e) {
        console.warn('Failed to calculate route during delivery creation', e);
        // Fallback to straight line estimate if OSRM fails
        const dist = this.locationService.calculateDistance(data.pickup.coordinates, data.dropoff.coordinates);
        route = {
          distanceKm: dist,
          estimatedMinutes: Math.ceil(dist * 2) // Rough estimate
        };
      }
    }

    const baseDeliveryFee = Number(
      data.financials?.deliveryFee
      || data.financials?.baseDeliveryFee
      || data.fee
      || data.earnings
      || process.env.MIN_DELIVERY_FEE
      || 500
    );
    const dispatchConfig = this.getDispatchConfig();
    const delivery = new this.deliveryModel({
      ...data,
      financials: {
        ...(data.financials || {}),
        baseDeliveryFee,
        deliveryFee: baseDeliveryFee,
        searchSurcharge: 0,
      },
      dispatch: {
        strategy: 'PROGRESSIVE_RADIUS',
        initialRadiusMeters: dispatchConfig.initialRadiusMeters,
        currentRadiusMeters: null,
        nextRadiusMeters: dispatchConfig.initialRadiusMeters,
        stepMeters: dispatchConfig.closeRangeStepMeters,
        maxRadiusMeters: dispatchConfig.maxRadiusMeters,
        broadcastCount: 0,
        notifiedRiderIds: [],
      },
      route,
      status: DeliveryStatus.ASSIGNED
    });

    const saved = await delivery.save();
    
    // Dispatch starts close to the pickup point, then expands until one rider accepts.
    try {
      this.scheduleAdaptiveBroadcast(String(saved._id), 0);
    } catch (e) {
      console.error('Failed to broadcast delivery request', e);
    }

    return saved;
  }

  private async triggerNotification(userId: string, type: string, params: any) {
    try {
      const url = `${process.env.NOTIFICATION_SERVICE_URL || 'http://localhost:3009/api/v1'}/notifications/dispatch`;
      const axios = require('axios');
      const secret = process.env.INTERNAL_SERVICE_SECRET;
      const headers = secret ? { 'x-internal-service-key': secret } : {};
      await axios.post(url, { userId, type, params, channels: ['IN_APP', 'SMS'] }, { headers });
    } catch (error: any) {
      console.error(`Failed to trigger notification: ${type}`, error.message);
    }
  }

  async updateStatus(id: string, newStatus: DeliveryStatus, actorUserId?: string): Promise<any> {
    const delivery = await this.deliveryModel.findById(id);
    if (!delivery) throw new NotFoundException('Delivery not found');

    if (actorUserId && actorUserId !== 'internal-service' && newStatus === DeliveryStatus.DELIVERED && String(delivery.rider?.userId || '') !== String(actorUserId)) {
      throw new BadRequestException('Only the assigned rider can complete this delivery');
    }

    if (newStatus === DeliveryStatus.PICKED_UP && delivery.status !== DeliveryStatus.PICKED_UP) {
      if (actorUserId && actorUserId !== 'internal-service' && String(delivery.rider?.userId || '') !== String(actorUserId)) {
        throw new BadRequestException('Only the assigned rider can mark this delivery as picked up');
      }

      const hasPickupProof = Boolean(delivery.pickup?.pickupPhotoUrl && delivery.pickup?.qrScannedAt && delivery.pickup?.qrPayload);
      const hasHandoverApproval = Boolean(delivery.pickup?.sellerConfirmed && delivery.pickup?.riderConfirmed);
      if (!hasPickupProof) {
        throw new BadRequestException('Pickup requires packaged goods photo and verified stall QR first');
      }
      if (!hasHandoverApproval) {
        throw new BadRequestException('Pickup requires seller and rider handover confirmation');
      }
    }

    this.validateTransition(delivery.status, newStatus);

    const updates: any = { status: newStatus };

    if (newStatus === DeliveryStatus.DELIVERED) {
      updates['dropoff.deliveredAt'] = new Date();
      if (delivery.rider?.userId) {
        this.triggerNotification(delivery.rider.userId, 'order.delivered', { orderNumber: delivery.orderNumber, orderId: delivery.orderId });
      }
      // Increment rider stats
      if (delivery.rider?.riderId) {
        await this.riderModel.findByIdAndUpdate(delivery.rider.riderId, {
          $inc: { totalDeliveries: 1 }
        }).catch(err => console.error('Failed to increment rider deliveries:', err.message));
      }
    }

    const updatedDelivery = await this.deliveryModel.findByIdAndUpdate(
      id,
      { $set: updates },
      { new: true }
    );

    // Notify the order-service
    if (updatedDelivery?.orderId) {
      let orderStatus = '';
      if (newStatus === DeliveryStatus.PICKED_UP) orderStatus = 'picked_up';
      if (newStatus === DeliveryStatus.DELIVERED) orderStatus = 'awaiting_confirmation';
      
      if (orderStatus) {
        this.deliveryGateway.server.emit(`order:${updatedDelivery.orderId}:status`, { status: orderStatus });
        try {
          const axios = require('axios');
          const orderUrl = process.env.ORDER_SERVICE_URL || 'http://localhost:3006/api/v1';
          const secret = process.env.INTERNAL_SERVICE_SECRET;
          const headers = secret ? { 'x-internal-service-key': secret } : {};
          axios.put(`${orderUrl}/orders/${updatedDelivery.orderId}/status`, {
            status: orderStatus, 
            userId: delivery.rider?.userId || 'internal-service'
          }, { headers }).then(() => console.log(`Successfully updated order ${updatedDelivery.orderId} to ${orderStatus}`))
            .catch((e: any) => { console.error(`Failed to update order ${updatedDelivery.orderId} to ${orderStatus}:`, e.message); });
        } catch(err: any) {
          console.error('Axios require or sync error:', err);
        }
      }
    }

    return updatedDelivery;
  }

  async completeDelivery(id: string, actorUserId: string): Promise<any> {
    return this.updateStatus(id, DeliveryStatus.DELIVERED, actorUserId);
  }

  async photoVerifiedPickup(id: string, photoUrl: string, qrData: string, actorUserId?: string): Promise<any> {
    const delivery = await this.deliveryModel.findById(id);
    if (!delivery) throw new NotFoundException('Delivery not found');

    if (actorUserId && String(delivery.rider?.userId || '') !== String(actorUserId)) {
      throw new BadRequestException('Only the assigned rider can verify pickup for this delivery');
    }
    
    if (delivery.status !== DeliveryStatus.EN_ROUTE_TO_PICKUP) {
      throw new StateConflictError('Must be EN_ROUTE_TO_PICKUP to perform pickup');
    }

    if (!photoUrl) {
      throw new BadRequestException('Photo evidence of packaged goods is required before pickup');
    }

    if (!qrData) {
      throw new BadRequestException('A scanned stall QR payload is required before pickup');
    }

    // Validate QR code matches stall
    const expectedQrData = `marketrwanda:stall:${delivery.pickup.stallId}`;
    if (qrData !== expectedQrData) {
      throw new BadRequestException('Invalid QR code for this stall');
    }

    // Process pickup transition to PENDING_HANDOVER for mutual confirmation
    this.validateTransition(delivery.status, DeliveryStatus.PENDING_HANDOVER);
    
    const updatedDelivery = await this.deliveryModel.findByIdAndUpdate(
      id,
      { 
        $set: { 
          status: DeliveryStatus.PENDING_HANDOVER,
          'pickup.qrScannedAt': new Date(),
          'pickup.qrVerifiedBy': actorUserId || delivery.rider?.userId,
          'pickup.qrPayload': qrData,
          'pickup.pickupPhotoUrl': photoUrl
        } 
      },
      { new: true }
    );
    
    return updatedDelivery;
  }

  async streamLocation(id: string, coords: Coordinates, actorUserId?: string, actorRole?: string): Promise<any> {
    if (!this.locationService.validateCoordinates(coords)) {
      throw new BadRequestException('Invalid coordinates');
    }

    const delivery = await this.deliveryModel.findById(id);
    if (!delivery) throw new NotFoundException('Delivery not found');
    const isAdmin = String(actorRole || '').toUpperCase() === 'ADMIN';
    if (!isAdmin && String(delivery.rider?.userId || '') !== String(actorUserId || '')) {
      throw new BadRequestException('Only the assigned rider can stream location for this delivery');
    }

    // Route deviation detection logic
    const pickupCoords = { lat: delivery.pickup.coordinates.lat, lng: delivery.pickup.coordinates.lng };
    const dropoffCoords = { lat: delivery.dropoff.coordinates.lat, lng: delivery.dropoff.coordinates.lng };
    const expectedTotalDist = delivery.route.distanceKm;

    // Calculate distance traveled from pickup + remaining distance to dropoff
    // If the sum significantly exceeds the expected route distance, the rider is off-route
    const distFromStart = this.locationService.calculateDistance(pickupCoords, coords);
    const distToDropoff = this.locationService.calculateDistance(coords, dropoffCoords);
    const actualRoute = distFromStart + distToDropoff;

    if (actualRoute > expectedTotalDist * 1.5) {
      console.warn(
        `Route deviation detected for delivery ${id}. ` +
        `Expected: ${expectedTotalDist.toFixed(1)}km, ` +
        `Actual (start->current->dropoff): ${actualRoute.toFixed(1)}km ` +
        `(${distFromStart.toFixed(1)}km + ${distToDropoff.toFixed(1)}km). ` +
        `>1.5x threshold.`
      );
    }

    return await this.deliveryModel.findByIdAndUpdate(
      id,
      { 
        $push: { 
          tracking: { 
            lat: coords.lat, 
            lng: coords.lng, 
            recordedAt: new Date() 
          } 
        } 
      },
      { new: true }
    );
  }

  async getAvailableDeliveries(): Promise<any[]> {
    return this.deliveryModel.find({
      status: DeliveryStatus.ASSIGNED,
      $or: [
        { 'rider.riderId': { $exists: false } },
        { 'rider.riderId': null }
      ]
    }).sort({ createdAt: -1 }).exec();
  }

  async getActiveDelivery(userId: string): Promise<any> {
    // Resolve userId to rider profile ID if necessary
    let riderProfileId = userId;
    const riderProfile = await this.riderModel.findOne({ userId }).exec();
    if (riderProfile) {
      riderProfileId = riderProfile._id.toString();
    }

    // Schema stores rider reference under rider.riderId (nested), not top-level
    return this.deliveryModel.findOne({
      'rider.riderId': riderProfileId,
      status: { $in: [DeliveryStatus.ASSIGNED, DeliveryStatus.EN_ROUTE_TO_PICKUP, DeliveryStatus.PENDING_HANDOVER, DeliveryStatus.PICKED_UP, DeliveryStatus.EN_ROUTE_TO_DROPOFF] }
    }).exec();
  }

  async acceptDelivery(id: string, riderId: string): Promise<any> {
    // 1. Check if rider already has an active delivery
    const activeDelivery = await this.getActiveDelivery(riderId);
    if (activeDelivery) {
      throw new ConflictException('You already have an active delivery. Please complete it before accepting a new one.');
    }

    // 2. Resolve rider profile
    let riderProfile = await this.riderModel.findById(riderId).exec().catch(() => null);
    if (!riderProfile) {
      riderProfile = await this.riderModel.findOne({ userId: riderId }).exec();
    }
    if (!riderProfile) {
      throw new NotFoundException('Rider profile not found');
    }

    // Atomic check-and-set: only update if delivery still has no rider assigned.
    // This prevents two riders from accepting the same delivery concurrently.
    const delivery = await this.deliveryModel.findOneAndUpdate(
      {
        _id: id,
        status: DeliveryStatus.ASSIGNED,
        // Only accept if no rider has been assigned yet (null or missing)
        $or: [
          { 'rider.riderId': { $exists: false } },
          { 'rider.riderId': null }
        ]
      },
      {
        $set: {
          status: DeliveryStatus.EN_ROUTE_TO_PICKUP,
        }
      },
      { new: true }
    );
    if (!delivery) {
      // Check if the delivery exists at all vs already assigned
      const exists = await this.deliveryModel.findById(id).exec();
      if (!exists) throw new NotFoundException('Delivery not found');
      throw new ConflictException('Delivery already accepted by another rider');
    }

    // The delivery-service does not have the User schema registered, so we use default fallbacks
    // The frontend mainly relies on riderId and plateNumber anyway.

    // Now set the rider details in a second atomic update
    const updatedDelivery = await this.deliveryModel.findByIdAndUpdate(
      id,
      {
        $set: {
          'rider.riderId': riderProfile._id,
          'rider.userId': riderProfile.userId,
          'rider.fullName': 'Rider',
          'rider.phone': '',
          'rider.plateNumber': riderProfile.plateNumber,
          'dispatch.acceptedAt': new Date(),
        }
      },
      { new: true }
    );

    if (updatedDelivery) {
      this.clearDispatchTimer(id);
      this.triggerNotification(riderProfile.userId, 'delivery.assigned', { 
        orderNumber: updatedDelivery.orderNumber, 
        orderId: updatedDelivery.orderId,
        riderName: 'You' 
      });

      // Notify the order-service and frontend tracking page that a rider is en route.
      // We do NOT call updateStatus() here because the atomic findOneAndUpdate above
      // already transitioned the status to EN_ROUTE_TO_PICKUP.
      if (updatedDelivery.orderId) {
        this.deliveryGateway.server.emit(`order:${updatedDelivery.orderId}:status`, { status: 'confirmed' });
      }
    }

    return updatedDelivery;
  }

  async confirmHandover(id: string, role: 'seller' | 'rider', actorUserId?: string, actorRole?: string): Promise<any> {
    const delivery = await this.deliveryModel.findById(id);
    if (!delivery) throw new NotFoundException('Delivery not found');

    if (delivery.status !== DeliveryStatus.PENDING_HANDOVER) {
      throw new StateConflictError('Pickup photo and stall QR must be verified before handover confirmation');
    }

    const normalizedRole = String(actorRole || '').toUpperCase();
    const isAdmin = normalizedRole === 'ADMIN';

    if (role === 'rider' && actorUserId && !isAdmin && String(delivery.rider?.userId || '') !== String(actorUserId)) {
      throw new BadRequestException('Only the assigned rider can confirm rider handover');
    }

    if (role === 'seller' && actorUserId && !isAdmin) {
      const order = await this.orderModel.findById(delivery.orderId).select('seller sellerUserId').lean().exec();
      const sellerUserId = this.normalizeId(order?.seller?.userId || order?.sellerUserId);
      if (!sellerUserId || sellerUserId !== this.normalizeId(actorUserId)) {
        throw new BadRequestException('Only the order seller can confirm seller handover');
      }
    }

    const updateField = role === 'seller' ? 'pickup.sellerConfirmed' : 'pickup.riderConfirmed';
    
    const updatedDelivery = await this.deliveryModel.findByIdAndUpdate(
      id,
      { $set: { [updateField]: true } },
      { new: true }
    );

    // Notify parties about the confirmation
    this.deliveryGateway.server.emit(`delivery:${id}:handover_update`, { 
      sellerConfirmed: updatedDelivery.pickup.sellerConfirmed,
      riderConfirmed: updatedDelivery.pickup.riderConfirmed
    });

    // If both confirmed, move to PICKED_UP
    if (updatedDelivery.pickup.sellerConfirmed && updatedDelivery.pickup.riderConfirmed) {
      return await this.updateStatus(id, DeliveryStatus.PICKED_UP, 'internal-service');
    }

    return updatedDelivery;
  }

  async rejectDelivery(id: string, actorUserId?: string, actorRole?: string): Promise<any> {
    // Validate ID format
    if (!id.match(/^[0-9a-fA-F]{24}$/)) {
      throw new BadRequestException('Invalid delivery ID format');
    }

    // Rejecting a delivery should NOT fail it permanently.
    // Instead, unassign the rider so the delivery goes back to the pool
    // for other riders. Only fail the delivery if explicitly requested.
    const query: any = {
        _id: id,
        status: { $in: [DeliveryStatus.ASSIGNED, DeliveryStatus.EN_ROUTE_TO_PICKUP] }
      };
    if (String(actorRole || '').toUpperCase() !== 'ADMIN') {
      query['rider.userId'] = actorUserId;
    }

    const delivery = await this.deliveryModel.findOneAndUpdate(
      query,
      {
        $set: {
          status: DeliveryStatus.ASSIGNED,
          'rider.riderId': null,
          'rider.userId': null,
          'rider.fullName': null,
          'rider.phone': null,
          'rider.plateNumber': null,
        }
      },
      { new: true }
    );

    if (!delivery) {
      // Check if it exists at all
      const exists = await this.deliveryModel.findById(id).exec();
      if (!exists) {
        throw new NotFoundException(`Delivery ${id} not found`);
      }
      throw new ConflictException(`Delivery ${id} cannot be rejected at its current status (${exists.status})`);
    }

    // Notify other available riders that the delivery is available again
    try {
      this.scheduleAdaptiveBroadcast(String(delivery._id), 0);
    } catch (e) {
      console.error('Failed to rebroadcast delivery request after rejection', e);
    }

    return delivery;
  }

  async rebroadcastDelivery(id: string): Promise<any> {
    if (!id.match(/^[0-9a-fA-F]{24}$/)) {
      throw new BadRequestException('Invalid delivery ID format');
    }

    const delivery = await this.deliveryModel.findOne({
      _id: id,
      status: DeliveryStatus.ASSIGNED,
      $and: [
        {
          $or: [
            { 'rider.riderId': { $exists: false } },
            { 'rider.riderId': null },
          ],
        },
        {
          $or: [
            { 'rider.userId': { $exists: false } },
            { 'rider.userId': null },
          ],
        },
      ],
    }).exec();

    if (!delivery) {
      const exists = await this.deliveryModel.findById(id).exec();
      if (!exists) {
        throw new NotFoundException(`Delivery ${id} not found`);
      }
      throw new ConflictException('Delivery already has a rider or is not waiting for assignment');
    }

    const waitingSince = delivery.dispatch?.lastBroadcastAt || delivery.createdAt;
    const waitingMs = waitingSince ? Date.now() - new Date(waitingSince).getTime() : 0;
    if (waitingMs < MANUAL_REBROADCAST_WAIT_MS) {
      throw new ConflictException('Manual rebroadcast is available after 5 minutes without rider acceptance');
    }

    const config = this.getDispatchConfig();
    await this.deliveryModel.findByIdAndUpdate(id, {
      $set: {
        'dispatch.strategy': 'PROGRESSIVE_RADIUS',
        'dispatch.initialRadiusMeters': config.initialRadiusMeters,
        'dispatch.currentRadiusMeters': null,
        'dispatch.nextRadiusMeters': config.initialRadiusMeters,
        'dispatch.stepMeters': config.closeRangeStepMeters,
        'dispatch.maxRadiusMeters': config.maxRadiusMeters,
        'dispatch.manualRebroadcastAt': new Date(),
      },
      $inc: { 'dispatch.manualRebroadcastCount': 1 },
    }).exec();

    this.scheduleAdaptiveBroadcast(id, 0);
    return this.deliveryModel.findById(id).exec();
  }

  async getHistory(userId: string): Promise<any[]> {
    let riderProfileId = userId;
    const riderProfile = await this.riderModel.findOne({ userId }).exec();
    if (riderProfile) riderProfileId = riderProfile._id.toString();

    return this.deliveryModel.find({
      'rider.riderId': riderProfileId,
      status: DeliveryStatus.DELIVERED
    }).sort({ createdAt: -1 }).limit(50).exec();
  }

  async getRiderDeliveries(userId: string, status?: string): Promise<any[]> {
    let riderProfileId = userId;
    const riderProfile = await this.riderModel.findOne({ userId }).exec();
    if (riderProfile) riderProfileId = riderProfile._id.toString();

    const query: any = { 'rider.riderId': riderProfileId };
    if (status) {
      query.status = { $in: status.split(',') };
    }
    return this.deliveryModel.find(query).sort({ createdAt: -1 }).exec();
  }
}
