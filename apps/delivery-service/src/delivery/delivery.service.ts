import { Injectable, NotFoundException, BadRequestException, ConflictException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { LocationService, RouteService, Coordinates } from '@rmf/location';
import { DeliveryStatus } from '@rmf/shared-types';
import { StateConflictError } from '@rmf/shared-utils';

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
    @InjectModel('Delivery') private deliveryModel: Model<any>
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

    const delivery = new this.deliveryModel({
      ...data,
      status: DeliveryStatus.ASSIGNED
    });

    return await delivery.save();
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

  async getActiveDelivery(riderId: string): Promise<any> {
    return this.deliveryModel.findOne({ 
      riderId, 
      status: { $in: [DeliveryStatus.ASSIGNED, DeliveryStatus.EN_ROUTE_TO_PICKUP, DeliveryStatus.PICKED_UP, DeliveryStatus.EN_ROUTE_TO_DROPOFF] } 
    }).exec();
  }

  async acceptDelivery(id: string): Promise<any> {
    return await this.updateStatus(id, DeliveryStatus.EN_ROUTE_TO_PICKUP);
  }

  async rejectDelivery(id: string): Promise<any> {
    return await this.updateStatus(id, DeliveryStatus.FAILED);
  }
}
