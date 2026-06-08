import { Injectable, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import axios from 'axios';

/**
 * Affiliate commission settlement (Feature 3, order side).
 *
 * SECURITY:
 *  - Commission is only credited once per order (guarded by settlement.affiliateStatus).
 *  - The commission rate is re-capped at AFFILIATE_MAX_COMMISSION_RATE here as defence in depth.
 *  - Self-referral is blocked: if the buyer is the affiliate, the credit is skipped and logged.
 */
@Injectable()
export class AffiliateService {
  private readonly logger = new Logger(AffiliateService.name);

  constructor(
    @InjectModel('Transaction') private orderModel: Model<any>,
    @InjectModel('ReferralLink') private linkModel: Model<any>,
    @InjectModel('AffiliateProfile') private profileModel: Model<any>,
  ) {}

  private maxCommissionRate(): number {
    const parsed = parseInt(process.env.AFFILIATE_MAX_COMMISSION_RATE || '15', 10);
    return Number.isFinite(parsed) && parsed > 0 ? parsed : 15;
  }

  /** Returns true if the slug maps to an active referral link. */
  async linkExists(slug: string): Promise<boolean> {
    if (!slug) return false;
    const link = await this.linkModel.findOne({ slug, status: 'active', deletedAt: null }).select('_id').lean().exec();
    return Boolean(link);
  }

  async creditAffiliateCommission(orderId: string): Promise<void> {
    const order = await this.orderModel.findById(orderId).exec();
    if (!order) return;
    if (!order.affiliateCode) return;
    if (order.settlement?.affiliateStatus === 'credited') return; // idempotent

    const link = await this.linkModel.findOne({ slug: order.affiliateCode }).exec();
    if (!link) {
      this.logger.warn(`Affiliate link not found for code ${order.affiliateCode} on order ${order.orderNumber}`);
      return;
    }

    const buyerId = String(order.buyer?.userId || '');
    const affiliateUserId = String(link.affiliateUserId || '');

    // SECURITY: never pay commission on self-referrals.
    if (buyerId && affiliateUserId && buyerId === affiliateUserId) {
      this.logger.warn(
        `[AFFILIATE] Self-referral blocked: buyer ${buyerId} == affiliate ${affiliateUserId} on order ${order.orderNumber}`,
      );
      await this.orderModel.findByIdAndUpdate(orderId, { $set: { 'settlement.affiliateStatus': 'skipped_self_referral' } });
      return;
    }

    const subtotal = Number(order.financials?.subtotal || 0);
    const rate = Math.min(Number(link.commissionRate) || 0, this.maxCommissionRate());
    const commission = Math.round((subtotal * rate) / 100);
    if (commission <= 0) {
      await this.orderModel.findByIdAndUpdate(orderId, { $set: { 'settlement.affiliateStatus': 'skipped_zero' } });
      return;
    }

    try {
      const walletServiceUrl = process.env.WALLET_SERVICE_URL || 'http://localhost:3007/api/v1';
      const secret = process.env.INTERNAL_SERVICE_SECRET;
      const headers = secret ? { 'x-internal-service-key': secret } : {};

      // NOTE: the wallet internal/credit endpoint accepts { userId, role, amount, orderId,
      // orderNumber, description }. The affiliate is a BUYER-role user earning a commission;
      // the wallet ledger records the credit against their wallet.
      await axios.post(
        `${walletServiceUrl}/wallets/internal/credit`,
        {
          userId: affiliateUserId,
          role: 'BUYER',
          amount: commission,
          orderId: String(order._id),
          orderNumber: order.orderNumber,
          description: `Affiliate commission (${rate}%) for order ${order.orderNumber}`,
          referenceType: 'affiliate',
          account: 'affiliate_commission',
        },
        { headers },
      );

      await Promise.all([
        this.linkModel.findByIdAndUpdate(link._id, {
          $inc: { conversionCount: 1, totalEarned: commission },
        }),
        this.profileModel.updateOne(
          { userId: link.affiliateUserId },
          { $inc: { totalConversions: 1, totalEarnings: commission } },
        ),
        this.orderModel.findByIdAndUpdate(orderId, { $set: { 'settlement.affiliateStatus': 'credited' } }),
      ]);

      this.logger.log(`[AFFILIATE] Credited ${commission} RWF to affiliate ${affiliateUserId} for order ${order.orderNumber}`);
    } catch (err: any) {
      this.logger.error(`[AFFILIATE] Commission credit failed for order ${order.orderNumber}: ${err?.message}`);
    }
  }
}
