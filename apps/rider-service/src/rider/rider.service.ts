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
    @InjectModel('Delivery') private deliveryModel: Model<any>,
    @InjectModel('ProfileChangeRequest') private changeRequestModel: Model<any>
  ) {
    this.locationService = new LocationService();
  }

  private cleanString(value: any, max = 500): string | undefined {
    const cleaned = String(value ?? '').replace(/[\u0000-\u001f\u007f]/g, ' ').replace(/\s+/g, ' ').trim();
    return cleaned ? cleaned.slice(0, max) : undefined;
  }

  private sanitizeRiderSettings(input: any) {
    const changes: any = {};
    const plateNumber = this.cleanString(input?.plateNumber, 32);
    if (plateNumber) changes.plateNumber = plateNumber.toUpperCase();
    for (const key of ['licenseUrl', 'vehiclePhotoUrl', 'idCardUrl', 'insuranceUrl'] as const) {
      const value = this.cleanString(input?.[key], 600);
      if (value) changes[key] = value;
    }
    return changes;
  }

  async create(riderData: any): Promise<any> {
    const existing = await this.riderModel.findOne({ 
      $or: [{ userId: riderData.userId }, { plateNumber: riderData.plateNumber }]
    });

    if (existing) {
      throw new ConflictException('Rider profile or plate number already exists');
    }

    const newRider = new this.riderModel(riderData);
    const saved = await newRider.save();
    this.notifyAdminsAction(`New rider application (Plate: ${saved.plateNumber || 'N/A'}) is awaiting your review.`);
    return saved;
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

    // 4A/3F: sync role to user-service
    this.syncRoleToUserService(updated.userId, 'RIDER').catch(() => {});
    // Notify rider of approval
    this.triggerNotification(updated.userId, 'Congratulations! Your rider application has been approved. You can now accept deliveries.');
    // Notify admins of approval
    this.notifyAdminsAction(`Rider (Plate: ${updated.plateNumber || 'N/A'}) approved successfully.`);
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
    // Notify admins of rejection
    this.notifyAdminsAction(`Rider (Plate: ${updated.plateNumber || 'N/A'}) application declined.`);
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

  async createSettingsChangeRequest(userId: string, data: any): Promise<any> {
    const rider = await this.findByUserId(userId);
    const requestedChanges = this.sanitizeRiderSettings(data);
    if (!Object.keys(requestedChanges).length) {
      throw new BadRequestException('No editable rider settings were provided');
    }
    const existing = await this.changeRequestModel.findOne({
      targetType: 'RIDER',
      targetId: rider._id,
      status: 'PENDING',
    }).exec();
    if (existing) {
      throw new ConflictException('A rider settings change request is already awaiting admin review');
    }
    const request = await this.changeRequestModel.create({
      targetType: 'RIDER',
      targetId: rider._id,
      userId: rider.userId,
      requestedChanges,
      auditTrail: [{ action: 'created', actorId: userId, note: 'rider_settings_change_requested', at: new Date() }],
    });
    this.notifyAdminsAction(`Rider (Plate: ${rider.plateNumber || 'N/A'}) requested settings changes.`);
    return request;
  }

  async listSettingsChangeRequests(status = 'PENDING'): Promise<any[]> {
    const query: any = { targetType: 'RIDER' };
    if (status) query.status = status;
    return this.changeRequestModel.find(query).sort({ createdAt: -1 }).exec();
  }

  async approveSettingsChangeRequest(id: string, adminId: string, notes?: string): Promise<any> {
    const request = await this.changeRequestModel.findOne({ _id: id, targetType: 'RIDER', status: 'PENDING' }).exec();
    if (!request) throw new NotFoundException('Rider settings change request not found');
    await this.riderModel.findByIdAndUpdate(request.targetId, { $set: request.requestedChanges || {} }).exec();
    request.status = 'APPROVED';
    request.reviewedBy = /^[0-9a-fA-F]{24}$/.test(String(adminId || '')) ? adminId : undefined;
    request.reviewNotes = this.cleanString(notes, 500);
    request.reviewedAt = new Date();
    request.appliedAt = new Date();
    request.auditTrail.push({ action: 'approved', actorId: adminId, note: request.reviewNotes, at: new Date() });
    await request.save();
    this.triggerNotification(request.userId, 'Your rider settings update was approved and applied.');
    return request;
  }

  async rejectSettingsChangeRequest(id: string, adminId: string, notes?: string): Promise<any> {
    const request = await this.changeRequestModel.findOne({ _id: id, targetType: 'RIDER', status: 'PENDING' }).exec();
    if (!request) throw new NotFoundException('Rider settings change request not found');
    request.status = 'REJECTED';
    request.reviewedBy = /^[0-9a-fA-F]{24}$/.test(String(adminId || '')) ? adminId : undefined;
    request.reviewNotes = this.cleanString(notes, 500);
    request.reviewedAt = new Date();
    request.auditTrail.push({ action: 'rejected', actorId: adminId, note: request.reviewNotes, at: new Date() });
    await request.save();
    this.triggerNotification(request.userId, request.reviewNotes || 'Your rider settings update needs changes before approval.');
    return request;
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

    const delivered = await this.deliveryModel.find({
      'rider.userId': userId,
      status: 'delivered',
    }).select('fee deliveryFee riderPayout').lean().exec();
    const earnings = delivered.reduce((sum: number, delivery: any) => {
      const payout = Number(delivery.riderPayout ?? 0);
      const fee = Number(delivery.fee ?? delivery.deliveryFee ?? 0);
      return sum + (payout > 0 ? payout : Math.round(fee * 0.9));
    }, 0);

    return {
      earnings,
      completion: Math.round((1 - (rider.rejectionRate || 0)) * 100),
      rating: rider.rating || 5.0,
      drops
    };
  }

  private async syncRoleToUserService(userId: string, role: string) {
    try {
      const axios = require('axios');
      const userUrl = process.env.USER_SERVICE_URL || 'http://localhost:3001/api/v1';
      const secret = process.env.INTERNAL_SERVICE_SECRET;
      const headers = secret ? { 'x-internal-service-key': secret } : {};
      await axios.put(`${userUrl}/users/${userId}/role`, { role }, { headers });
    } catch (e: any) {
      this.logger.warn(`Failed to sync rider role for ${userId}: ${e.message}`);
    }
  }

  private triggerNotification(userId: string, message: string) {
    try {
      const axios = require('axios');
      const notificationUrl = process.env.NOTIFICATION_SERVICE_URL || 'http://localhost:3009/api/v1';
      const secret = process.env.INTERNAL_SERVICE_SECRET;
      const headers = secret ? { 'x-internal-service-key': secret } : {};
      axios.post(`${notificationUrl}/notifications/in-app`, {
        userId,
        type: 'rider.status_update',
        params: { message }
      }, { headers }).catch(() => {});
    } catch {}
  }

  private async notifyAdminsAction(message: string) {
    try {
      const axios = require('axios');
      const notificationUrl = process.env.NOTIFICATION_SERVICE_URL || 'http://localhost:3009/api/v1';
      const secret = process.env.INTERNAL_SERVICE_SECRET;
      const headers = secret ? { 'x-internal-service-key': secret } : {};
      await axios.post(`${notificationUrl}/notifications/admin-notify`, {
        type: 'admin.notification',
        params: { message }
      }, { headers }).catch(() => {});
    } catch (e: any) {
      this.logger.warn(`Failed to notify admins of action: ${e.message}`);
    }
  }

  async findNearbyRiders(lat: number, lng: number, maxDistanceMeters: number): Promise<any[]> {
    const activeRiders = await this.riderModel.find({
      isActive: true,
      isApproved: true,
      deletedAt: null,
      'currentLocation.lat': { $ne: null },
      'currentLocation.lng': { $ne: null }
    }).exec();

    const center = { lat, lng };
    return activeRiders
      .map(rider => {
        const riderCoords = {
          lat: rider.currentLocation.lat,
          lng: rider.currentLocation.lng
        };
        const distanceKm = this.locationService.calculateDistance(center, riderCoords);
        const distanceMeters = Math.round(distanceKm * 1000);
        return {
          rider,
          distanceMeters
        };
      })
      .filter(item => item.distanceMeters <= maxDistanceMeters)
      .sort((a, b) => a.distanceMeters - b.distanceMeters);
  }
}
