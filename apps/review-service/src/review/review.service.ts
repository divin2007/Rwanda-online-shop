import { Injectable, NotFoundException, BadRequestException, ConflictException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';

@Injectable()
export class ReviewService {
  constructor(
    @InjectModel('Review') private reviewModel: Model<any>,
    @InjectModel('SellerProfile') private sellerModel: Model<any>,
    @InjectModel('RiderProfile') private riderModel: Model<any>
  ) {}

  async submitReview(data: {
    orderId: string;
    buyerId: string;
    targetType: 'seller' | 'rider';
    targetId: string;
    rating: number;
    comment?: string;
  }): Promise<any> {
    if (data.rating < 1 || data.rating > 5) {
      throw new BadRequestException('Rating must be between 1 and 5');
    }

    const existing = await this.reviewModel.findOne({ 
      orderId: data.orderId, 
      targetType: data.targetType 
    });

    if (existing) {
      throw new ConflictException(`You have already reviewed the ${data.targetType} for this order`);
    }

    const review = new this.reviewModel(data);
    await review.save();

    // Re-calculate the average rating for the target
    await this.updateTargetAverageRating(data.targetType, data.targetId);

    return review;
  }

  private async updateTargetAverageRating(targetType: 'seller' | 'rider', targetId: string): Promise<void> {
    // Calculate new average using MongoDB aggregation
    const result = await this.reviewModel.aggregate([
      { $match: { targetType, targetId: targetId as any, deletedAt: null } },
      { $group: { _id: null, avgRating: { $avg: '$rating' }, totalReviews: { $sum: 1 } } }
    ]);

    if (result.length > 0) {
      const avg = Number(result[0].avgRating.toFixed(2));
      const model = targetType === 'seller' ? this.sellerModel : this.riderModel;
      
      // Update the rating field directly on the profile model for quick read access
      await model.findByIdAndUpdate(targetId, { $set: { rating: avg } });
    }
  }

  async getReviewsForTarget(targetType: 'seller' | 'rider', targetId: string): Promise<any[]> {
    return this.reviewModel.find({ targetType, targetId, deletedAt: null })
      .sort({ createdAt: -1 })
      .exec();
  }
}
