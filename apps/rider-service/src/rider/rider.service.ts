import { Injectable, NotFoundException, BadRequestException, ConflictException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { LocationService, Coordinates } from '@rmf/location';

@Injectable()
export class RiderService {
  private locationService: LocationService;

  constructor(
    @InjectModel('RiderProfile') private riderModel: Model<any>
  ) {
    this.locationService = new LocationService();
  }

  async create(riderData: any): Promise<any> {
    const existing = await this.riderModel.findOne({ 
      $or: [{ userId: riderData.userId }, { plateNumber: riderData.plateNumber }]
    });

    if (existing) {
      throw new ConflictException('Rider profile or plate number already exists');
    }

    const newRider = new this.riderModel(riderData);
    return await newRider.save();
  }

  async findByUserId(userId: string): Promise<any> {
    const rider = await this.riderModel.findOne({ userId, deletedAt: null }).exec();
    if (!rider) {
      throw new NotFoundException('Rider profile not found');
    }
    return rider;
  }

  async updateStatus(userId: string, isActive: boolean, location?: Coordinates): Promise<any> {
    // If turning active, location must be provided and valid
    if (isActive) {
      if (!location || !this.locationService.validateCoordinates(location)) {
        throw new BadRequestException('Valid GPS location must be provided to turn active');
      }
    }

    const updates: any = { isActive };
    if (location) {
      updates.currentLocation = {
        lat: location.lat,
        lng: location.lng,
        updatedAt: new Date()
      };
    }

    const updated = await this.riderModel.findOneAndUpdate(
      { userId, deletedAt: null },
      { $set: updates },
      { new: true }
    ).exec();

    if (!updated) {
      throw new NotFoundException('Rider profile not found');
    }

    return updated;
  }

  async updateLocation(userId: string, location: Coordinates): Promise<any> {
    if (!this.locationService.validateCoordinates(location)) {
      throw new BadRequestException('Invalid GPS coordinates');
    }

    const updated = await this.riderModel.findOneAndUpdate(
      { userId, deletedAt: null, isActive: true }, // Only update if active
      { 
        $set: { 
          currentLocation: {
            lat: location.lat,
            lng: location.lng,
            updatedAt: new Date()
          }
        } 
      },
      { new: true }
    ).exec();

    if (!updated) {
      throw new NotFoundException('Rider profile not found or rider is offline');
    }

    return updated;
  }

  async updateMetrics(userId: string, data: { ratingUpdate?: number, rejection?: boolean }): Promise<any> {
    const rider = await this.findByUserId(userId);
    const updates: any = {};

    if (data.ratingUpdate !== undefined) {
      // Stub: Real system would do proper moving average
      const totalDeliveries = rider.totalDeliveries + 1;
      const currentRatingTotal = rider.rating * rider.totalDeliveries;
      updates.rating = (currentRatingTotal + data.ratingUpdate) / totalDeliveries;
      updates.totalDeliveries = totalDeliveries;
    }

    if (data.rejection === true) {
      // Rejection rate logic
      const rate = rider.rejectionRate || 0;
      updates.rejectionRate = Math.min(rate + 0.05, 1.0); // Increment rejection rate by 5%
    }

    return this.riderModel.findOneAndUpdate(
      { userId, deletedAt: null },
      { $set: updates },
      { new: true }
    ).exec();
  }
}
