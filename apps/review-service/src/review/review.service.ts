import { Injectable, NotFoundException, BadRequestException, ConflictException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';

@Injectable()
export class ReviewService {
  constructor(
    @InjectModel('Review') private reviewModel: Model<any>,
    @InjectModel('SellerProfile') private sellerModel: Model<any>,
    @InjectModel('RiderProfile') private riderModel: Model<any>,
    @InjectModel('Market') private marketModel: Model<any>,
    @InjectModel('Product') private productModel: Model<any>
  ) {}

  async submitReview(data: {
    orderId: string;
    buyerId: string;
    targetType: 'seller' | 'rider' | 'market' | 'product';
    targetId: string;
    rating: number;
    comment?: string;
  }): Promise<any> {
    if (data.rating < 1 || data.rating > 5) {
      throw new BadRequestException('Rating must be between 1 and 5');
    }

    const cleanTargetId = data.targetId.includes(':') ? data.targetId.split(':')[0] : data.targetId;
    if (!Types.ObjectId.isValid(cleanTargetId)) {
      throw new BadRequestException(`Invalid targetId: ${data.targetId}`);
    }
    data.targetId = cleanTargetId;

    const existing = await this.reviewModel.findOne({ 
      orderId: data.orderId, 
      targetType: data.targetType,
      targetId: data.targetId
    });

    if (existing) {
      throw new ConflictException(`You have already reviewed this ${data.targetType} for this order`);
    }

    const review = new this.reviewModel(data);
    await review.save();

    // Re-calculate the average rating for the target
    await this.updateTargetAverageRating(data.targetType, data.targetId);

    return review;
  }

  private async updateTargetAverageRating(targetType: 'seller' | 'rider' | 'market' | 'product', targetId: string): Promise<void> {
    const result = await this.reviewModel.aggregate([
      { $match: { targetType, targetId: targetId as any, deletedAt: null } },
      { $group: { _id: null, avgRating: { $avg: '$rating' }, totalReviews: { $sum: 1 } } }
    ]);

    if (result.length > 0) {
      const avg = Number(result[0].avgRating.toFixed(2));
      let model: Model<any>;
      
      switch (targetType) {
        case 'seller': model = this.sellerModel; break;
        case 'rider': model = this.riderModel; break;
        case 'market': model = this.marketModel; break;
        case 'product': model = this.productModel; break;
      }
      
      if (model) {
        await model.findByIdAndUpdate(targetId, { $set: { rating: avg } });
      }
    }
  }

  async getReviewsForTarget(targetType: 'seller' | 'rider' | 'market' | 'product', targetId: string): Promise<any[]> {
    const cleanTargetId = targetId.includes(':') ? targetId.split(':')[0] : targetId;
    if (!Types.ObjectId.isValid(cleanTargetId)) {
      throw new BadRequestException(`Invalid targetId: ${targetId}`);
    }
    return this.reviewModel.find({ targetType, targetId: cleanTargetId, deletedAt: null })
      .sort({ createdAt: -1 })
      .exec();
  }
}
