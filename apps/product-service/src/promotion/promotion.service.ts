import { Injectable, NotFoundException, BadRequestException, ConflictException, ForbiddenException } from '@nestjs/common';
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

    // Map User ID to SellerProfile ID if needed
    if (promotionData.sellerId) {
      try {
        const seller = await this.productModel.db.model('SellerProfile').findOne({ userId: promotionData.sellerId }).exec();
        if (seller) {
          promotionData.sellerId = seller._id;
        }
      } catch {
        // If lookup fails, try using the product's sellerId
      }
    }
    // Fallback: use the product's sellerId
    if (!promotionData.sellerId) {
      promotionData.sellerId = product.sellerId;
    }

    // Auto-set startDate if not provided
    if (!promotionData.startDate) {
      promotionData.startDate = new Date();
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

    // Store computed promoted price in the promotion
    promotionData.promotedPrice = Math.round(promotionalPrice);

    const newPromotion = new this.promotionModel(promotionData);
    return await newPromotion.save();
  }

  async getActivePromotions(marketId?: string): Promise<any[]> {
    const now = new Date();
    const query: any = {
      isActive: true,
      startDate: { $lte: now },
      endDate: { $gt: now }
    };
    
    const promos = await this.promotionModel.find(query).populate('productId').exec();
    
    // Enrich with product data as a `product` field for easier frontend consumption
    return promos.map((promo: any) => {
      const p = promo.toObject();
      p.product = p.productId; // populated product doc
      return p;
    });
  }

  async findAll(sellerId?: string, marketId?: string): Promise<any[]> {
    const query: any = { deletedAt: null };
    
    if (sellerId) {
      // Map User ID to SellerProfile ID
      const seller = await this.productModel.db.model('SellerProfile').findOne({ userId: sellerId }).exec();
      query.sellerId = seller ? seller._id : sellerId;
    }
    
    const promos = await this.promotionModel.find(query).populate('productId').exec();
    
    // Enrich with product data
    return promos.map((promo: any) => {
      const p = promo.toObject();
      p.product = p.productId;
      return p;
    });
  }

  async deletePromotion(id: string, actorUserId?: string, actorRole?: string): Promise<any> {
    const promo = await this.promotionModel.findById(id);
    if (!promo) {
      throw new NotFoundException('Promotion not found');
    }

    if (actorRole !== 'ADMIN' && actorUserId) {
      const seller = await this.productModel.db.model('SellerProfile').findOne({ userId: actorUserId }).exec();
      if (!seller || String(promo.sellerId) !== String(seller._id)) {
        throw new ForbiddenException('You can only delete your own promotions');
      }
    }
    
    // Soft delete
    promo.isActive = false;
    promo.deletedAt = new Date();
    return await promo.save();
  }
}
