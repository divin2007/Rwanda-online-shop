import { Injectable, NotFoundException, BadRequestException, ConflictException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { PromotionType } from '@rmf/shared-types';

@Injectable()
export class PromotionService {
  constructor(
    @InjectModel('Promotion') private promotionModel: Model<any>,
    @InjectModel('Product') private productModel: Model<any>
  ) {}

  async createPromotion(promotionData: any): Promise<any> {
    const product = await this.productModel.findById(promotionData.productId);
    if (!product) {
      throw new NotFoundException('Product not found');
    }

    // Check if product already has an active promotion
    const existingPromo = await this.promotionModel.findOne({
      productId: promotionData.productId,
      isActive: true,
      endDate: { $gt: new Date() }
    });

    if (existingPromo) {
      throw new ConflictException('Product already has an active promotion');
    }

    // Ensure promotional price doesn't drop below 100 RWF (commission floor rule)
    let promotionalPrice = product.price;
    if (promotionData.type === PromotionType.PERCENTAGE) {
      promotionalPrice = product.price * (1 - promotionData.discount / 100);
    } else if (promotionData.type === PromotionType.FIXED_AMOUNT) {
      promotionalPrice = product.price - promotionData.discount;
    }

    if (promotionalPrice < 100) {
      throw new BadRequestException('Promotion causes price to drop below the 100 RWF minimum limit');
    }

    const newPromotion = new this.promotionModel(promotionData);
    return await newPromotion.save();
  }

  async getActivePromotions(marketId?: string): Promise<any[]> {
    // In a real scenario we might need an aggregation to join with products, 
    // or keep a denormalized cache. We fetch all active valid promos:
    const now = new Date();
    const query: any = {
      isActive: true,
      startDate: { $lte: now },
      endDate: { $gt: now }
    };
    
    // Stub implementation: finding promos and populating product
    return this.promotionModel.find(query).populate('productId').exec();
  }

  async findAll(sellerId?: string, marketId?: string): Promise<any[]> {
    const query: any = { deletedAt: null };
    
    if (sellerId) {
      // Map User ID to SellerProfile ID
      const seller = await this.productModel.db.model('SellerProfile').findOne({ userId: sellerId }).exec();
      query.sellerId = seller ? seller._id : sellerId;
    }
    
    return this.promotionModel.find(query).populate('productId').exec();
  }
}
