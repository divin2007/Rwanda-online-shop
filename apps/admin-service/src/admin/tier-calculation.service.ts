import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { OrderStatus, SellerTier } from '@rmf/shared-types';

/**
 * Seller Certification Tiers (Feature 11).
 *
 * Weekly job that recomputes every approved seller's tier from delivered order volume,
 * average rating and dispute rate. Tiers:
 *   GOLD   : totalOrders >= 200 AND rating >= 4.5 AND disputeRate <= 0.02
 *   SILVER : totalOrders >=  50 AND rating >= 4.0 AND disputeRate <= 0.05
 *   BRONZE : otherwise (default)
 */
@Injectable()
export class TierCalculationService {
  private readonly logger = new Logger(TierCalculationService.name);

  constructor(
    @InjectModel('SellerProfile') private sellerModel: Model<any>,
    @InjectModel('Transaction') private orderModel: Model<any>,
  ) {}

  @Cron('0 2 * * 0') // Every Sunday 02:00
  async scheduledRecalculation(): Promise<void> {
    if (process.env.SELLER_TIER_COMPUTE_ENABLED === 'false') {
      this.logger.log('Seller tier computation disabled via SELLER_TIER_COMPUTE_ENABLED=false');
      return;
    }
    await this.recalculateAllTiers();
  }

  async recalculateAllTiers(): Promise<{ processed: number; updated: number }> {
    this.logger.log('Starting weekly seller tier recalculation...');
    const sellers = await this.sellerModel.find({ isApproved: true, deletedAt: null }).exec();
    let updated = 0;

    for (const seller of sellers) {
      try {
        const metrics = await this.computeSellerMetrics(seller);
        const tier = this.resolveTier(metrics);
        await this.sellerModel.findByIdAndUpdate(seller._id, {
          $set: {
            certificationTier: tier,
            tierCalculatedAt: new Date(),
            tierMetrics: {
              disputeRate: metrics.disputeRate,
              avgRating: metrics.avgRating,
              totalOrders: metrics.totalOrders,
            },
          },
        });
        updated++;
      } catch (err: any) {
        this.logger.error(`Tier calculation failed for seller ${seller._id}: ${err?.message}`);
      }
    }

    this.logger.log(`Seller tier recalculation complete. Processed ${sellers.length}, updated ${updated}.`);
    return { processed: sellers.length, updated };
  }

  private async computeSellerMetrics(seller: any): Promise<{ totalOrders: number; disputeRate: number; avgRating: number }> {
    const sellerMatch: any = { 'seller.sellerId': seller._id, deletedAt: null };

    const totalOrders = await this.orderModel.countDocuments({
      ...sellerMatch,
      status: OrderStatus.DELIVERED,
    });

    const disputedCount = await this.orderModel.countDocuments({
      ...sellerMatch,
      'dispute.isDisputed': true,
    });

    // Dispute rate is measured against all non-deleted orders for the seller (not just delivered),
    // so abandoned/disputed orders still count against the rate.
    const allOrders = await this.orderModel.countDocuments(sellerMatch);
    const disputeRate = allOrders > 0 ? disputedCount / allOrders : 0;

    return {
      totalOrders,
      disputeRate: Number(disputeRate.toFixed(4)),
      avgRating: Number(seller.rating || 0),
    };
  }

  private resolveTier(metrics: { totalOrders: number; disputeRate: number; avgRating: number }): SellerTier {
    const { totalOrders, disputeRate, avgRating } = metrics;
    if (totalOrders >= 200 && avgRating >= 4.5 && disputeRate <= 0.02) return SellerTier.GOLD;
    if (totalOrders >= 50 && avgRating >= 4.0 && disputeRate <= 0.05) return SellerTier.SILVER;
    return SellerTier.BRONZE;
  }
}
