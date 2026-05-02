import { Injectable, NotFoundException, BadRequestException, ConflictException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { LocationService } from '@rmf/location';
import { MarketType } from '@rmf/shared-types';

@Injectable()
export class SellerService {
  private locationService: LocationService;

  constructor(
    @InjectModel('SellerProfile') private sellerModel: Model<any>,
    @InjectModel('Market') private marketModel: Model<any> // Local copy logic or proxy to market service
  ) {
    this.locationService = new LocationService();
  }

  async create(sellerData: any): Promise<any> {
    const existing = await this.sellerModel.findOne({ userId: sellerData.userId });
    if (existing) {
      throw new ConflictException('Seller profile already exists for this user');
    }

    let marketId = sellerData.marketId;

    // Handle Individual Market creation flow
    if (sellerData.marketType === MarketType.INDIVIDUAL) {
      // Validate map coordinates for the stall/market
      if (!sellerData.location || !this.locationService.validateCoordinates(sellerData.location.coordinates)) {
        throw new BadRequestException('Invalid map coordinates provided for individual market');
      }

      const newMarket = new this.marketModel({
        name: sellerData.shopName,
        slug: sellerData.slug,
        code: sellerData.slug.substring(0, 3).toUpperCase(),
        type: MarketType.INDIVIDUAL,
        ownerId: sellerData.userId,
        location: sellerData.location,
        operatingHours: sellerData.operatingHours || { open: '08:00', close: '20:00', daysOpen: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'] }
      });
      
      const savedMarket = await newMarket.save();
      marketId = savedMarket._id;
    } else {
      // Joining a public market
      if (!marketId) {
        throw new BadRequestException('marketId is required when joining a public market');
      }
    }

    // Generate Stall ID
    const market = await this.marketModel.findById(marketId);
    if (!market) {
      throw new NotFoundException('Market not found');
    }
    
    // Simple ID generation strategy: CODE-XXX
    const count = await this.sellerModel.countDocuments({ marketId });
    const stallId = `${market.code}-${String(count + 1).padStart(3, '0')}`;

    const newSeller = new this.sellerModel({
      userId: sellerData.userId,
      marketId,
      stallId,
      stallName: sellerData.stallName || sellerData.shopName,
      description: sellerData.description,
      businessPermitUrl: sellerData.businessPermitUrl,
      idCardUrl: sellerData.idCardUrl,
      stallPhotoUrl: sellerData.stallPhotoUrl
    });

    return await newSeller.save();
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
      { $set: { isApproved: true } },
      { new: true }
    ).exec();

    if (!updated) {
      throw new NotFoundException('Seller profile not found');
    }
    
    // In a real system, trigger SMS notification here: “Your shop is now live on [Market Name]!”
    return updated;
  }

  async generateQrCode(stallId: string): Promise<string> {
    // Stub for QR code generation
    // Returns a URL to the generated QR code sticker or a base64 string
    return `https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=marketrwanda:stall:${stallId}`;
  }
}
