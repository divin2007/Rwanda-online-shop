import { Injectable, NotFoundException, BadRequestException, ConflictException, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { LocationService, Coordinates } from '@rmf/location';

@Injectable()
export class RiderService {
  private readonly logger = new Logger(RiderService.name);
  private locationService: LocationService;

  constructor(
    @InjectModel('RiderProfile') private riderModel: Model<any>,
    @InjectModel('Delivery') private deliveryModel: Model<any>
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

  async findAll(isApproved?: boolean): Promise<any[]> {
    const query: any = { deletedAt: null };
    if (isApproved !== undefined) {
      if (isApproved === false) {
        // Handle missing field as false
        query.$or = [{ isApproved: false }, { isApproved: { $exists: false } }];
      } else {
        query.isApproved = true;
      }
    }
    return this.riderModel.find(query).sort({ createdAt: -1 }).exec();
  }

  async approve(id: string): Promise<any> {
    const updated = await this.riderModel.findByIdAndUpdate(
      id,
      { $set: { isApproved: true } },
      { new: true }
    ).exec();

    if (!updated) {
      throw new NotFoundException('Rider profile not found');
    }

    // 4C fix: create wallet with rider role on approval so deductWeeklyInsurance finds them
    this.ensureWalletExists(updated.userId).catch(e => {
      this.logger.warn(`Failed to create wallet for rider ${updated.userId}: ${e.message}`);
    });
    // 4A/3F: sync role to user-service
    this.syncRoleToUserService(updated.userId, 'RIDER').catch(() => {});
    // Notify rider of approval
    this.triggerNotification(updated.userId, 'Congratulations! Your rider application has been approved. You can now accept deliveries.');
    return updated;
  }

  // 4A fix: add reject endpoint for admin to decline rider applications
  async reject(id: string, reason?: string): Promise<any> {
    const updated = await this.riderModel.findByIdAndUpdate(
      id,
      { $set: { isApproved: false, rejectedAt: new Date(), rejectionReason: reason || 'Application declined' } },
      { new: true }
    ).exec();

    if (!updated) {
      throw new NotFoundException('Rider profile not found');
    }

    this.triggerNotification(updated.userId, reason || 'Your rider application has been declined. Contact support for details.');
    return updated;
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
      { userId, deletedAt: null }, // Allow updating location even if offline
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
      // 4D fix: don't use the default 5.0 rating as if it came from real reviews.
      // If totalDeliveries is 0, the first rating should NOT average against 5.0.
      const hasRealRating = rider.totalDeliveries > 0;
      const totalDeliveries = rider.totalDeliveries + 1;
      if (hasRealRating) {
        const currentRatingTotal = rider.rating * rider.totalDeliveries;
        updates.rating = (currentRatingTotal + data.ratingUpdate) / totalDeliveries;
      } else {
        // First real review — just use it directly (not averaged against the 5.0 default)
        updates.rating = data.ratingUpdate;
      }
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

  async getStats(userId: string): Promise<any> {
    const rider = await this.riderModel.findOne({ userId }).exec();
    if (!rider) return { earnings: 0, completion: 100, rating: 5, drops: 0 };
    
    // Healing logic: if totalDeliveries is 0, count from Delivery collection
    let drops = rider.totalDeliveries || 0;
    if (drops === 0) {
      const actualCount = await this.deliveryModel.countDocuments({ 
        'rider.userId': userId, 
        status: 'delivered' 
      }).exec();
      if (actualCount > 0) {
        drops = actualCount;
        // Background sync: don't wait
        this.riderModel.findByIdAndUpdate(rider._id, { $set: { totalDeliveries: actualCount } }).exec();
      }
    }

    // 4B fix: fetch real earnings from wallet-service instead of returning 0
    let earnings = 0;
    try {
      const axios = require('axios');
      const walletUrl = process.env.WALLET_SERVICE_URL || 'http://localhost:3007/api/v1';
      const res = await axios.get(`${walletUrl}/wallets/${userId}/balance`);
      earnings = res.data?.data?.totalEarnings || 0;
    } catch {
      this.logger.warn(`Could not fetch wallet earnings for rider ${userId}`);
    }

    return {
      earnings,
      completion: Math.round((1 - (rider.rejectionRate || 0)) * 100),
      rating: rider.rating || 5.0,
      drops
    };
  }

  // Helper: create wallet with rider role on approval
  private async ensureWalletExists(userId: string) {
    const axios = require('axios');
    const walletUrl = process.env.WALLET_SERVICE_URL || 'http://localhost:3007/api/v1';
    await axios.post(`${walletUrl}/wallets/ensure`, { userId, role: 'rider' }).catch(() => {
      // Try the generic balance endpoint which auto-creates
      return axios.get(`${walletUrl}/wallets/${userId}/balance`);
    });
  }

  private async syncRoleToUserService(userId: string, role: string) {
    try {
      const axios = require('axios');
      const userUrl = process.env.USER_SERVICE_URL || 'http://localhost:3001/api/v1';
      await axios.put(`${userUrl}/users/${userId}/role`, { role });
    } catch (e: any) {
      this.logger.warn(`Failed to sync rider role for ${userId}: ${e.message}`);
    }
  }

  private triggerNotification(userId: string, message: string) {
    try {
      const axios = require('axios');
      const notificationUrl = process.env.NOTIFICATION_SERVICE_URL || 'http://localhost:3009/api/v1';
      axios.post(`${notificationUrl}/notifications/in-app`, {
        userId,
        type: 'rider.status_update',
        params: { message }
      }).catch(() => {});
    } catch {}
  }
}
