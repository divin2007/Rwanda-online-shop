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
    @InjectModel('Product') private productModel: Model<any>,
    @InjectModel('Transaction') private orderModel: Model<any>,
    @InjectModel('Delivery') private deliveryModel: Model<any>
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

    await this.assertReviewAllowed(data);

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
    await this.updateOrderReviewCompletion(data.orderId);

    return review;
  }

  private idsMatch(left: any, right: any): boolean {
    return Boolean(left && right && String(left) === String(right));
  }

  private async assertReviewAllowed(data: {
    orderId: string;
    buyerId: string;
    targetType: 'seller' | 'rider' | 'market' | 'product';
    targetId: string;
  }): Promise<void> {
    if (!Types.ObjectId.isValid(data.orderId)) {
      throw new BadRequestException(`Invalid orderId: ${data.orderId}`);
    }

    const order = await this.orderModel.findById(data.orderId).lean().exec();
    if (!order) throw new NotFoundException('Order not found');
    if (!this.idsMatch(order.buyer?.userId, data.buyerId)) {
      throw new BadRequestException('Only the buyer of this order can submit reviews');
    }
    if (order.status !== 'delivered') {
      throw new BadRequestException('Reviews unlock after the buyer confirms delivery');
    }

    if (data.targetType === 'seller' && !this.idsMatch(order.seller?.sellerId, data.targetId)) {
      throw new BadRequestException('Seller review target does not belong to this order');
    }

    if (data.targetType === 'market' && !this.idsMatch(order.seller?.marketId, data.targetId)) {
      throw new BadRequestException('Market review target does not belong to this order');
    }

    if (data.targetType === 'product') {
      const hasProduct = (order.products || []).some((item: any) => this.idsMatch(item.productId, data.targetId));
      if (!hasProduct) {
        throw new BadRequestException('Product review target does not belong to this order');
      }
    }

    if (data.targetType === 'rider') {
      if (!order.deliveryId) {
        throw new BadRequestException('This order has no rider delivery to review');
      }
      const delivery = await this.deliveryModel.findById(order.deliveryId).lean().exec();
      if (!delivery || !this.idsMatch(delivery.rider?.riderId, data.targetId)) {
        throw new BadRequestException('Rider review target does not belong to this order');
      }
    }
  }

  private async updateOrderReviewCompletion(orderId: string): Promise<void> {
    const order = await this.orderModel.findById(orderId).lean().exec();
    if (!order) return;

    const expectedTargets = new Set<string>();
    if (order.seller?.sellerId) expectedTargets.add(`seller:${String(order.seller.sellerId)}`);
    if (order.seller?.marketId) expectedTargets.add(`market:${String(order.seller.marketId)}`);
    for (const product of order.products || []) {
      if (product.productId) expectedTargets.add(`product:${String(product.productId)}`);
    }
    if (order.deliveryId) {
      const delivery = await this.deliveryModel.findById(order.deliveryId).lean().exec();
      if (delivery?.rider?.riderId) expectedTargets.add(`rider:${String(delivery.rider.riderId)}`);
    }

    if (expectedTargets.size === 0) return;

    const reviews = await this.reviewModel.find({ orderId, deletedAt: null }).select('targetType targetId').lean().exec();
    const reviewedTargets = new Set(reviews.map((review: any) => `${review.targetType}:${String(review.targetId)}`));
    const complete = Array.from(expectedTargets).every(target => reviewedTargets.has(target));
    if (complete) {
      await this.orderModel.findByIdAndUpdate(orderId, { $set: { hasBeenRated: true } }).exec();
    }
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

  async getReviewsForOrder(orderId: string, buyerId: string): Promise<any[]> {
    if (!Types.ObjectId.isValid(orderId)) {
      throw new BadRequestException(`Invalid orderId: ${orderId}`);
    }
    const order = await this.orderModel.findById(orderId).select('buyer.userId').lean().exec();
    if (!order) throw new NotFoundException('Order not found');
    if (!this.idsMatch(order.buyer?.userId, buyerId)) {
      throw new BadRequestException('Only the buyer can view their order review status');
    }
    return this.reviewModel.find({ orderId, buyerId, deletedAt: null }).sort({ createdAt: -1 }).lean().exec();
  }
}
