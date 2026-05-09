import { Injectable, NotFoundException, BadRequestException, ConflictException, forwardRef, Inject } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { LocationService, RouteService, Coordinates } from '@rmf/location';
import { DeliveryStatus } from '@rmf/shared-types';
import { StateConflictError } from '@rmf/shared-utils';
import { DeliveryGateway } from './delivery.gateway';

const DELIVERY_TRANSITIONS: Record<string, string[]> = {
  [DeliveryStatus.ASSIGNED]: [DeliveryStatus.EN_ROUTE_TO_PICKUP, DeliveryStatus.FAILED],
  [DeliveryStatus.EN_ROUTE_TO_PICKUP]: [DeliveryStatus.PENDING_HANDOVER, DeliveryStatus.PICKED_UP, DeliveryStatus.FAILED],
  [DeliveryStatus.PENDING_HANDOVER]: [DeliveryStatus.PICKED_UP, DeliveryStatus.FAILED],
  [DeliveryStatus.PICKED_UP]: [DeliveryStatus.EN_ROUTE_TO_DROPOFF, DeliveryStatus.DELIVERED, DeliveryStatus.FAILED],
  [DeliveryStatus.EN_ROUTE_TO_DROPOFF]: [DeliveryStatus.DELIVERED, DeliveryStatus.FAILED],
  [DeliveryStatus.DELIVERED]: [],
  [DeliveryStatus.FAILED]: []
};

@Injectable()
export class DeliveryService {
  private locationService: LocationService;
  private routeService: RouteService;

  constructor(
    @InjectModel('Delivery') private deliveryModel: Model<any>,
    @InjectModel('RiderProfile') private riderModel: Model<any>,
    @Inject(forwardRef(() => DeliveryGateway))
    private readonly deliveryGateway: DeliveryGateway
  ) {
    this.locationService = new LocationService();
    this.routeService = new RouteService();
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

  async calculateDeliveryFee(from: Coordinates, to: Coordinates, weightFactor: number = 1): Promise<{ fee: number, route: any }> {
    const route = await this.routeService.getOptimizedRoute(from, to);
    
    // Tiered pricing: 500 RWF per 5km block
    // 0-5km = 500, 5-10km = 1000, 10-15km = 1500...
    const fee = Math.ceil(route.distanceKm / 5) * 500;

    return { fee, route };
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

    const delivery = new this.deliveryModel({
      ...data,
      route,
      status: DeliveryStatus.ASSIGNED
    });

    const saved = await delivery.save();
    
    // Notify all active riders via Socket.io
    try {
      this.deliveryGateway.emitAssignment(saved.toObject());
    } catch (e) {
      console.error('Failed to broadcast delivery request', e);
    }

    return saved;
  }

  async updateStatus(id: string, newStatus: DeliveryStatus): Promise<any> {
    const delivery = await this.deliveryModel.findById(id);
    if (!delivery) throw new NotFoundException('Delivery not found');

    this.validateTransition(delivery.status, newStatus);

    const updates: any = { status: newStatus };

    if (newStatus === DeliveryStatus.DELIVERED) {
      updates['dropoff.deliveredAt'] = new Date();
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
          axios.put(`${orderUrl}/orders/${updatedDelivery.orderId}/status`, { 
            status: orderStatus, 
            userId: delivery.rider?.userId || 'system' 
          }).then(() => console.log(`Successfully updated order ${updatedDelivery.orderId} to ${orderStatus}`))
            .catch((e: any) => { console.error(`Failed to update order ${updatedDelivery.orderId} to ${orderStatus}:`, e.message); });
        } catch(err: any) {
          console.error('Axios require or sync error:', err);
        }
      }
    }

    return updatedDelivery;
  }

  async photoVerifiedPickup(id: string, photoUrl: string, qrData: string): Promise<any> {
    const delivery = await this.deliveryModel.findById(id);
    if (!delivery) throw new NotFoundException('Delivery not found');
    
    if (delivery.status !== DeliveryStatus.EN_ROUTE_TO_PICKUP) {
      throw new StateConflictError('Must be EN_ROUTE_TO_PICKUP to perform pickup');
    }

    if (!photoUrl) {
      throw new BadRequestException('Photo evidence of packaged goods is required before pickup');
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
          'pickup.pickupPhotoUrl': photoUrl
        } 
      },
      { new: true }
    );
    
    return updatedDelivery;
  }

  async streamLocation(id: string, coords: Coordinates): Promise<any> {
    if (!this.locationService.validateCoordinates(coords)) {
      throw new BadRequestException('Invalid coordinates');
    }

    const delivery = await this.deliveryModel.findById(id);
    if (!delivery) throw new NotFoundException('Delivery not found');

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
    // Frontend sends user?.id, so we need to find the RiderProfile by userId OR _id
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
          'rider.plateNumber': riderProfile.plateNumber
        }
      },
      { new: true }
    );

    // Notify the frontend tracking page that a rider is coming
    if (updatedDelivery?.orderId) {
      // Move delivery status to EN_ROUTE_TO_PICKUP via internal update (triggers gateway)
      await this.updateStatus(id, DeliveryStatus.EN_ROUTE_TO_PICKUP);
    }

    return updatedDelivery;
  }

  async confirmHandover(id: string, role: 'seller' | 'rider'): Promise<any> {
    const delivery = await this.deliveryModel.findById(id);
    if (!delivery) throw new NotFoundException('Delivery not found');

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
      return await this.updateStatus(id, DeliveryStatus.PICKED_UP);
    }

    return updatedDelivery;
  }

  async rejectDelivery(id: string): Promise<any> {
    // Validate ID format
    if (!id.match(/^[0-9a-fA-F]{24}$/)) {
      throw new BadRequestException('Invalid delivery ID format');
    }

    // Rejecting a delivery should NOT fail it permanently.
    // Instead, unassign the rider so the delivery goes back to the pool
    // for other riders. Only fail the delivery if explicitly requested.
    const delivery = await this.deliveryModel.findOneAndUpdate(
      {
        _id: id,
        status: { $in: [DeliveryStatus.ASSIGNED, DeliveryStatus.EN_ROUTE_TO_PICKUP] }
      },
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
      this.deliveryGateway.emitAssignment(delivery.toObject());
    } catch (e) {
      console.error('Failed to rebroadcast delivery request after rejection', e);
    }

    return delivery;
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
}
