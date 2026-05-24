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
    @InjectModel('Market') private marketModel: Model<any>,
    @InjectModel('ProfileChangeRequest') private changeRequestModel: Model<any>
  ) {
    this.locationService = new LocationService();
  }

  private cleanString(value: any, max = 500): string | undefined {
    const cleaned = String(value ?? '').replace(/[\u0000-\u001f\u007f]/g, ' ').replace(/\s+/g, ' ').trim();
    return cleaned ? cleaned.slice(0, max) : undefined;
  }

  private flatten(prefix: string, value: Record<string, any>, output: Record<string, any> = {}) {
    for (const [key, item] of Object.entries(value || {})) {
      if (item === undefined) continue;
      const path = prefix ? `${prefix}.${key}` : key;
      if (item && typeof item === 'object' && !Array.isArray(item)) {
        this.flatten(path, item, output);
      } else {
        output[path] = item;
      }
    }
    return output;
  }

  private sanitizeSellerSettings(input: any) {
    const seller: any = {};
    const market: any = {};
    const shopDetails = input?.shopDetails || input?.shop || {};
    const marketDetails = input?.market || input?.marketDetails || {};

    const stallName = this.cleanString(input?.stallName || input?.shopName || shopDetails.name, 120);
    if (stallName) {
      seller.stallName = stallName;
      seller.shopDetails = { ...(seller.shopDetails || {}), name: stallName };
      market.name = stallName;
    }
    const description = this.cleanString(input?.description || shopDetails.description, 1200);
    if (description) {
      seller.description = description;
      seller.shopDetails = { ...(seller.shopDetails || {}), description };
      market.description = description;
    }

    for (const key of ['logoUrl', 'bannerUrl', 'imageUrl', 'hubImageUrl', 'tagline'] as const) {
      const value = this.cleanString(shopDetails[key], key.endsWith('Url') ? 600 : 180);
      if (value) seller.shopDetails = { ...(seller.shopDetails || {}), [key]: value };
    }
    if (Array.isArray(shopDetails.categories)) {
      seller.shopDetails = {
        ...(seller.shopDetails || {}),
        categories: shopDetails.categories.map((item: any) => this.cleanString(item, 80)).filter(Boolean).slice(0, 20),
      };
    }
    if (shopDetails.operatingHours && typeof shopDetails.operatingHours === 'object') {
      seller.shopDetails = {
        ...(seller.shopDetails || {}),
        operatingHours: {
          open: this.cleanString(shopDetails.operatingHours.open, 8),
          close: this.cleanString(shopDetails.operatingHours.close, 8),
          daysOpen: Array.isArray(shopDetails.operatingHours.daysOpen) ? shopDetails.operatingHours.daysOpen.map((day: any) => this.cleanString(day, 12)).filter(Boolean).slice(0, 7) : undefined,
        },
      };
      market.operatingHours = seller.shopDetails.operatingHours;
    }
    if (input?.capabilities && typeof input.capabilities === 'object') {
      seller.capabilities = {};
      for (const key of ['delivery', 'bulk', 'custom', 'returns']) {
        if (input.capabilities[key] !== undefined) seller.capabilities[key] = Boolean(input.capabilities[key]);
      }
    }
    if (input?.isOnVacation !== undefined) seller.isOnVacation = Boolean(input.isOnVacation);
    const vacationMessage = this.cleanString(input?.vacationMessage, 240);
    if (vacationMessage) seller.vacationMessage = vacationMessage;

    for (const key of ['imageUrl'] as const) {
      const value = this.cleanString(marketDetails[key], 600);
      if (value) market[key] = value;
    }
    if (marketDetails.location?.address) {
      market['location.address'] = this.cleanString(marketDetails.location.address, 240);
    }
    if (marketDetails.location?.coordinates && Array.isArray(marketDetails.location.coordinates)) {
      const [lng, lat] = marketDetails.location.coordinates.map(Number);
      if (Number.isFinite(lng) && Number.isFinite(lat)) market['location.coordinates'] = [lng, lat];
    }

    // Slugs are intentionally ignored; they are stable public URLs.
    return { seller, market };
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

  async createSettingsChangeRequest(userId: string, data: any): Promise<any> {
    const seller = await this.findByUserId(userId);
    const requestedChanges = this.sanitizeSellerSettings(data);
    if (!Object.keys(requestedChanges.seller).length && !Object.keys(requestedChanges.market).length) {
      throw new BadRequestException('No editable seller or market settings were provided');
    }

    const existing = await this.changeRequestModel.findOne({
      targetType: 'SELLER',
      targetId: seller._id,
      status: 'PENDING',
    }).exec();
    if (existing) {
      throw new ConflictException('A seller settings change request is already awaiting admin review');
    }

    const request = await this.changeRequestModel.create({
      targetType: 'SELLER',
      targetId: seller._id,
      userId: seller.userId,
      requestedChanges,
      auditTrail: [{ action: 'created', actorId: userId, note: 'seller_settings_change_requested', at: new Date() }],
    });
    this.notifyAdminsNewApplication(userId, `${seller.stallName || 'Seller'} settings change`).catch(() => {});
    return request;
  }

  async listSettingsChangeRequests(status = 'PENDING'): Promise<any[]> {
    const query: any = { targetType: 'SELLER' };
    if (status) query.status = status;
    return this.changeRequestModel.find(query).sort({ createdAt: -1 }).exec();
  }

  async approveSettingsChangeRequest(id: string, adminId: string, notes?: string): Promise<any> {
    const request = await this.changeRequestModel.findOne({ _id: id, targetType: 'SELLER', status: 'PENDING' }).exec();
    if (!request) throw new NotFoundException('Seller settings change request not found');

    const changes = request.requestedChanges || {};
    const sellerUpdates = this.flatten('', changes.seller || {});
    if (Object.keys(sellerUpdates).length) {
      await this.sellerModel.findByIdAndUpdate(request.targetId, { $set: sellerUpdates }).exec();
    }
    if (Object.keys(changes.market || {}).length) {
      const seller = await this.sellerModel.findById(request.targetId).exec();
      if (seller?.marketId) {
        const market = await this.marketModel.findById(seller.marketId).exec();
        const sellerOwnsMarket = market?.type === MarketType.INDIVIDUAL || String(market?.ownerId || '') === String(seller.userId || '');
        if (sellerOwnsMarket) {
          await this.marketModel.findByIdAndUpdate(seller.marketId, { $set: changes.market }).exec();
        }
      }
    }

    request.status = 'APPROVED';
    request.reviewedBy = /^[0-9a-fA-F]{24}$/.test(String(adminId || '')) ? adminId : undefined;
    request.reviewNotes = this.cleanString(notes, 500);
    request.reviewedAt = new Date();
    request.appliedAt = new Date();
    request.auditTrail.push({ action: 'approved', actorId: adminId, note: request.reviewNotes, at: new Date() });
    await request.save();
    this.triggerNotification(request.userId, 'Your seller settings update was approved and applied.');
    return request;
  }

  async rejectSettingsChangeRequest(id: string, adminId: string, notes?: string): Promise<any> {
    const request = await this.changeRequestModel.findOne({ _id: id, targetType: 'SELLER', status: 'PENDING' }).exec();
    if (!request) throw new NotFoundException('Seller settings change request not found');
    request.status = 'REJECTED';
    request.reviewedBy = /^[0-9a-fA-F]{24}$/.test(String(adminId || '')) ? adminId : undefined;
    request.reviewNotes = this.cleanString(notes, 500);
    request.reviewedAt = new Date();
    request.auditTrail.push({ action: 'rejected', actorId: adminId, note: request.reviewNotes, at: new Date() });
    await request.save();
    this.triggerNotification(request.userId, request.reviewNotes || 'Your seller settings update needs changes before approval.');
    return request;
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
    // Notify admins of approval
    this.notifyAdminsAction(`Seller "${updated.stallName || 'Merchant'}" approved successfully.`);
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
    // Notify admins of rejection
    this.notifyAdminsAction(`Seller "${updated.stallName || 'Merchant'}" application declined.`);
    return updated;
  }

  // 3F fix: update user role in user-service when a seller is approved
  private async syncRoleToUserService(userId: string, role: string) {
    try {
      const axios = require('axios');
      const userUrl = process.env.USER_SERVICE_URL || 'http://localhost:3001/api/v1';
      const secret = process.env.INTERNAL_SERVICE_SECRET;
      const headers = secret ? { 'x-internal-service-key': secret } : {};
      await axios.put(`${userUrl}/users/${userId}/role`, { role }, { headers });
      this.logger.log(`User ${userId} role synced to ${role} in user-service`);
    } catch (error: any) {
      this.logger.warn(`Failed to sync role for user ${userId}: ${error.message}`);
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
        type: 'seller.status_update',
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

  // 3C fix: notify all admin users about a new seller application
  private async notifyAdminsNewApplication(applicantUserId: string, stallName: string) {
    await this.notifyAdminsAction(`New seller application from "${stallName}" is awaiting your review.`);
  }

  async generateQrCode(stallId: string): Promise<string> {
    return `https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=marketrwanda:stall:${stallId}`;
  }
}
