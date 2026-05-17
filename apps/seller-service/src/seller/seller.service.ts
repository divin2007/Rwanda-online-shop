import { Injectable, NotFoundException, BadRequestException, ConflictException, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { LocationService } from '@rmf/location';
import { MarketType } from '@rmf/shared-types';

@Injectable()
export class SellerService {
  private readonly logger = new Logger(SellerService.name);
  private locationService: LocationService;

  constructor(
    @InjectModel('SellerProfile') private sellerModel: Model<any>,
    @InjectModel('Market') private marketModel: Model<any>
  ) {
    this.locationService = new LocationService();
  }

  async findAll(filter: any = {}): Promise<any[]> {
    return this.sellerModel.find({ ...filter, deletedAt: null }).exec();
  }

  async create(sellerData: any): Promise<any> {
    // 3E fix: check for existing active profile (not soft-deleted ones)
    const existing = await this.sellerModel.findOne({ userId: sellerData.userId, deletedAt: null });
    if (existing) {
      throw new ConflictException('Seller profile already exists for this user');
    }

    let marketId = sellerData.marketId;
    const location = sellerData.stallLocation || sellerData.location;
    const isIndividual = !marketId;
    const marketType = isIndividual ? MarketType.INDIVIDUAL : MarketType.PUBLIC;
    let createdMarketId: string | null = null;

    // Handle Individual Market creation flow
    if (marketType === MarketType.INDIVIDUAL) {
      if (!location) {
        throw new BadRequestException('Location is required for individual shops');
      }

      const shopDetails = sellerData.shopDetails || {};
      const operatingHours = shopDetails.operatingHours || {
        open: '08:00',
        close: '20:00',
        daysOpen: shopDetails.daysOpen || ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']
      };
      const newMarket = new this.marketModel({
        name: shopDetails.name || sellerData.shopName,
        slug: shopDetails.slug || sellerData.slug || `shop-${Date.now()}`,
        code: (shopDetails.slug || sellerData.slug || 'SHOP').substring(0, 3).toUpperCase(),
        type: MarketType.INDIVIDUAL,
        ownerId: sellerData.userId,
        imageUrl: shopDetails.imageUrl || null,
        description: shopDetails.description || sellerData.description || null,
        location: {
            type: 'Point',
            coordinates: [location.lng, location.lat],
            address: sellerData.address || "Rwanda Market",
            city: sellerData.city || "Kigali"
        },
        operatingHours
      });
      
      const savedMarket = await newMarket.save();
      marketId = savedMarket._id;
      createdMarketId = savedMarket._id.toString();
    }

    // Generate Stall ID — 3B fix: add random suffix to prevent race condition duplicates
    const market = await this.marketModel.findById(marketId);
    if (!market) {
      throw new NotFoundException('Selected market not found');
    }
    
    const count = await this.sellerModel.countDocuments({ marketId });
    const randomSuffix = Math.random().toString(36).substring(2, 4).toUpperCase();
    const stallId = `${market.code || 'SHOP'}-${String(count + 1).padStart(3, '0')}-${randomSuffix}`;

    // 3A fix: wrap seller creation in try/catch — if it fails, delete the orphan market
    try {
      const newSeller = new this.sellerModel({
        userId: sellerData.userId,
        marketId,
        stallId,
        stallName: sellerData.shopDetails?.name || sellerData.stallName || sellerData.shopName,
        description: sellerData.shopDetails?.description || sellerData.description,
        shopDetails: sellerData.shopDetails || {},
        businessPermitUrl: sellerData.documents?.rdb || sellerData.businessPermitUrl,
        rraCertificateUrl: sellerData.documents?.rra || sellerData.rraCertificateUrl,
        idCardUrl: sellerData.documents?.id || sellerData.idCardUrl,
        stallPhotoUrl: sellerData.documents?.photo || sellerData.stallPhotoUrl,
        capabilities: sellerData.capabilities || {},
        contractVersion: sellerData.contractVersion,
        agreedToTermsAt: sellerData.agreedToTerms ? new Date() : undefined,
        isApproved: false
      });

      const saved = await newSeller.save();

      // 3C fix: notify admin users about new seller application
      this.notifyAdminsNewApplication(sellerData.userId, saved.stallName || 'New seller').catch(() => {});

      return saved;
    } catch (error) {
      // 3A fix: clean up orphan market if seller profile save failed
      if (createdMarketId) {
        await this.marketModel.findByIdAndDelete(createdMarketId).catch(e => {
          this.logger.error(`Failed to clean up orphan market ${createdMarketId}: ${e.message}`);
        });
      }
      throw error;
    }
  }

  async findByUserId(userId: string): Promise<any> {
    const seller = await this.sellerModel.findOne({ userId, deletedAt: null }).exec();
    if (!seller) {
      throw new NotFoundException('Seller profile not found');
    }
    return seller;
  }

  async update(userId: string, updateData: any): Promise<any> {
    const updated = await this.sellerModel.findOneAndUpdate(
      { userId, deletedAt: null },
      { $set: updateData },
      { new: true }
    ).exec();

    if (!updated) {
      throw new NotFoundException('Seller profile not found');
    }

    return updated;
  }

  async approve(sellerId: string): Promise<any> {
    const updated = await this.sellerModel.findByIdAndUpdate(
      sellerId,
      { $set: { isApproved: true, rejectedAt: null } },
      { new: true }
    ).exec();

    if (!updated) {
      throw new NotFoundException('Seller profile not found');
    }
    
    // 3D fix: notify the seller that they've been approved
    this.triggerNotification(updated.userId, 'Congratulations! Your shop is now live on Rwanda Marketplace.');
    // 3F fix: sync SELLER role to user-service so JWT tokens reflect the correct role
    this.syncRoleToUserService(updated.userId, 'SELLER');
    return updated;
  }

  async reject(sellerId: string): Promise<any> {
    // 3E fix: use a rejected status instead of soft-delete (deletedAt).
    const updated = await this.sellerModel.findByIdAndUpdate(
      sellerId,
      { $set: { isApproved: false, rejectedAt: new Date() } },
      { new: true }
    ).exec();

    if (!updated) {
      throw new NotFoundException('Seller profile not found');
    }

    // 3D fix: notify the seller that their application was declined
    this.triggerNotification(updated.userId, 'Your seller application has been declined. Contact support for details.');
    return updated;
  }

  // 3F fix: update user role in user-service when a seller is approved
  private async syncRoleToUserService(userId: string, role: string) {
    try {
      const axios = require('axios');
      const userUrl = process.env.USER_SERVICE_URL || 'http://localhost:3001/api/v1';
      await axios.put(`${userUrl}/users/${userId}/role`, { role });
      this.logger.log(`User ${userId} role synced to ${role} in user-service`);
    } catch (error: any) {
      this.logger.warn(`Failed to sync role for user ${userId}: ${error.message}`);
    }
  }

  private triggerNotification(userId: string, message: string) {
    try {
      const axios = require('axios');
      const notificationUrl = process.env.NOTIFICATION_SERVICE_URL || 'http://localhost:3009/api/v1';
      axios.post(`${notificationUrl}/notifications/in-app`, {
        userId,
        type: 'seller.status_update',
        params: { message }
      }).catch(() => {});
    } catch {}
  }

  // 3C fix: notify all admin users about a new seller application
  private async notifyAdminsNewApplication(applicantUserId: string, stallName: string) {
    try {
      const axios = require('axios');
      const userUrl = process.env.USER_SERVICE_URL || 'http://localhost:3001/api/v1';
      const notificationUrl = process.env.NOTIFICATION_SERVICE_URL || 'http://localhost:3009/api/v1';
      // Fetch admin users from user-service
      const res = await axios.get(`${userUrl}/users?role=ADMIN`).catch(() => null);
      const admins = res?.data?.data || [];
      for (const admin of admins) {
        const adminId = admin._id || admin.id;
        if (!adminId) continue;
        await axios.post(`${notificationUrl}/notifications/in-app`, {
          userId: adminId,
          type: 'seller.status_update',
          params: { message: `New seller application from "${stallName}" is awaiting your review.` }
        }).catch(() => {});
        
        if (admin.email) {
          await axios.post(`${notificationUrl}/notifications/email`, {
            userId: adminId,
            email: admin.email,
            type: 'seller.status_update',
            params: { message: `New seller application from "${stallName}" is awaiting your review.` }
          }).catch(() => {});
        }
      }
    } catch (e: any) {
      this.logger.warn(`Failed to notify admins about new seller application: ${e.message}`);
    }
  }

  async generateQrCode(stallId: string): Promise<string> {
    return `https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=marketrwanda:stall:${stallId}`;
  }
}
