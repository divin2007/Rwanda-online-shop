import { Injectable, NotFoundException, BadRequestException, ConflictException, forwardRef, Inject } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { LocationService, RouteService, Coordinates } from '@rmf/location';
import { DeliveryStatus } from '@rmf/shared-types';
import { StateConflictError } from '@rmf/shared-utils';
import { DeliveryGateway } from './delivery.gateway';

const DELIVERY_TRANSITIONS: Record<string, string[]> = {
  [DeliveryStatus.ASSIGNED]: [DeliveryStatus.EN_ROUTE_TO_PICKUP, DeliveryStatus.FAILED],
  [DeliveryStatus.EN_ROUTE_TO_PICKUP]: [DeliveryStatus.PICKED_UP, DeliveryStatus.FAILED],
  [DeliveryStatus.PICKED_UP]: [DeliveryStatus.EN_ROUTE_TO_DROPOFF, DeliveryStatus.FAILED],
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
    const allowed = DELIVERY_TRANSITIONS[currentStatus];
    if (!allowed || !allowed.includes(newStatus)) {
      throw new StateConflictError(`Forbidden delivery transition: ${currentStatus} -> ${newStatus}`);
    }
  }

  async calculateDeliveryFee(from: Coordinates, to: Coordinates, weightFactor: number = 1): Promise<{ fee: number, route: any }> {
    const BASE_RATE_PER_KM = 80; // Could be cached from Redis and adjustable
    
    // In actual implementation, we might apply surge pricing (e.g. 1.2x at rush hour)
    const surgeMultiplier = 1.0; 

    const route = await this.routeService.getOptimizedRoute(from, to);
    
    const rawFee = route.distanceKm * BASE_RATE_PER_KM * weightFactor * surgeMultiplier;
    const fee = Math.ceil(rawFee / 100) * 100; // Round up to nearest 100 RWF

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
          estimatedMinutes: routeData.estimatedMinutes
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
      this.deliveryGateway.broadcastToNearbyRiders(
        saved.toObject(), 
        saved.pickup.coordinates.lat, 
        saved.pickup.coordinates.lng
      );
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

    return await this.deliveryModel.findByIdAndUpdate(
      id,
      { $set: updates },
      { new: true }
    );
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

    // Process pickup
    this.validateTransition(delivery.status, DeliveryStatus.PICKED_UP);
    
    return await this.deliveryModel.findByIdAndUpdate(
      id,
      { 
        $set: { 
          status: DeliveryStatus.PICKED_UP,
          'pickup.qrScannedAt': new Date(),
          'pickup.pickupPhotoUrl': photoUrl
        } 
      },
      { new: true }
    );
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
      status: { $in: [DeliveryStatus.ASSIGNED, DeliveryStatus.EN_ROUTE_TO_PICKUP, DeliveryStatus.PICKED_UP, DeliveryStatus.EN_ROUTE_TO_DROPOFF] }
    }).exec();
  }

  async acceptDelivery(id: string, riderId: string): Promise<any> {
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

    // Look up rider profile and user to populate nested rider fields
    const riderProfile = await this.riderModel.findById(riderId).exec();
    if (!riderProfile) {
      throw new NotFoundException('Rider profile not found');
    }
    const user = await this.riderModel.db.model('User').findById(riderProfile.userId).exec();

    // Now set the rider details in a second atomic update
    return await this.deliveryModel.findByIdAndUpdate(
      id,
      {
        $set: {
          'rider.riderId': riderProfile._id,
          'rider.userId': riderProfile.userId,
          'rider.fullName': user?.fullName || 'Rider',
          'rider.phone': user?.phone || '',
          'rider.plateNumber': riderProfile.plateNumber
        }
      },
      { new: true }
    );
  }

  async rejectDelivery(id: string): Promise<any> {
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
      throw new NotFoundException('Delivery not found or cannot be rejected at current status');
    }

    // Notify other available riders that the delivery is available again
    try {
      this.deliveryGateway.broadcastToNearbyRiders(
        delivery.toObject(),
        delivery.pickup.coordinates.lat,
        delivery.pickup.coordinates.lng
      );
    } catch (e) {
      console.error('Failed to rebroadcast delivery request after rejection', e);
    }

    return delivery;
  }
}
