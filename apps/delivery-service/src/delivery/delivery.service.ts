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
    
    // Check if the current point is wildly off the bounding box + margin
    const distFromStart = this.locationService.calculateDistance(pickupCoords, coords);
    const expectedTotalDist = delivery.route.distanceKm;

    if (distFromStart > expectedTotalDist * 1.5) {
      // Flag route deviation
      console.warn(`Route deviation detected for delivery ${id}. >1.5x expected distance.`);
      // If > 2.0x could trigger auto-suspension via rider service
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
    let riderId = userId;
    const riderProfile = await this.riderModel.findOne({ userId }).exec();
    if (riderProfile) {
      riderId = riderProfile._id.toString();
    }

    return this.deliveryModel.findOne({ 
      riderId, 
      status: { $in: [DeliveryStatus.ASSIGNED, DeliveryStatus.EN_ROUTE_TO_PICKUP, DeliveryStatus.PICKED_UP, DeliveryStatus.EN_ROUTE_TO_DROPOFF] } 
    }).exec();
  }

  async acceptDelivery(id: string, riderId: string): Promise<any> {
    const delivery = await this.deliveryModel.findById(id);
    if (!delivery) throw new NotFoundException('Delivery not found');
    
    if (delivery.riderId) {
      throw new ConflictException('Delivery already accepted by another rider');
    }

    // Associate rider and transition
    this.validateTransition(delivery.status, DeliveryStatus.EN_ROUTE_TO_PICKUP);

    return await this.deliveryModel.findByIdAndUpdate(
      id,
      { 
        $set: { 
          status: DeliveryStatus.EN_ROUTE_TO_PICKUP,
          riderId: riderId
        } 
      },
      { new: true }
    );
  }

  async rejectDelivery(id: string): Promise<any> {
    return await this.updateStatus(id, DeliveryStatus.FAILED);
  }
}
