import { Injectable, NotFoundException, BadRequestException, ForbiddenException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { customAlphabet } from 'nanoid';

const slugId = customAlphabet('abcdefghijklmnopqrstuvwxyz0123456789', 8);

/**
 * Market Influencers / Affiliate System (Feature 3).
 *
 * SECURITY:
 *  - commissionRate is hard-capped at AFFILIATE_MAX_COMMISSION_RATE (default 15%).
 *  - A ReferralLink can only be created by an approved affiliate whose AffiliateApplication
 *    for that product is approved.
 */
@Injectable()
export class AffiliateService {
  constructor(
    @InjectModel('AffiliateProfile') private profileModel: Model<any>,
    @InjectModel('ReferralLink') private linkModel: Model<any>,
    @InjectModel('AffiliateApplication') private applicationModel: Model<any>,
    @InjectModel('Product') private productModel: Model<any>,
    @InjectModel('SellerProfile') private sellerModel: Model<any>,
    @InjectModel('LedgerEntry') private ledgerModel: Model<any>,
  ) {}

  private maxCommissionRate(): number {
    const parsed = parseInt(process.env.AFFILIATE_MAX_COMMISSION_RATE || '15', 10);
    return Number.isFinite(parsed) && parsed > 0 ? parsed : 15;
  }

  async apply(userId: string, body: { displayName?: string }): Promise<any> {
    const existing = await this.profileModel.findOne({ userId }).lean().exec();
    if (existing) {
      throw new BadRequestException('You already have an affiliate profile');
    }
    return this.profileModel.create({
      userId,
      displayName: body?.displayName,
      status: 'pending',
    });
  }

  async getMe(userId: string): Promise<any> {
    const profile = await this.profileModel.findOne({ userId }).lean().exec();
    if (!profile) return null;
    const linkCount = await this.linkModel.countDocuments({ affiliateUserId: userId, deletedAt: null });
    return { ...profile, linkCount };
  }

  async getLinks(userId: string): Promise<any[]> {
    return this.linkModel.find({ affiliateUserId: userId, deletedAt: null }).sort({ createdAt: -1 }).lean().exec();
  }

  async createLink(userId: string, body: { productId?: string }): Promise<any> {
    if (!body?.productId || !Types.ObjectId.isValid(body.productId)) {
      throw new BadRequestException('A valid productId is required');
    }

    const profile = await this.profileModel.findOne({ userId }).lean().exec();
    if (!profile || profile.status !== 'approved') {
      throw new ForbiddenException('Your affiliate profile must be approved before creating links');
    }

    const application = await this.applicationModel
      .findOne({ applicantUserId: userId, productId: body.productId, status: 'approved' })
      .lean()
      .exec();
    if (!application) {
      throw new ForbiddenException('No approved application for this product. Apply and wait for seller approval.');
    }

    const product = await this.productModel.findById(body.productId).select('name sellerId marketId').lean().exec();
    if (!product) throw new NotFoundException('Product not found');

    const cap = this.maxCommissionRate();
    const commissionRate = Math.min(Number(application.proposedCommissionRate) || 5, cap);

    // Slug = market-code-ish prefix + product short name + random.
    const shortName = String(product.name || 'rmf').toLowerCase().replace(/[^a-z0-9]+/g, '').slice(0, 6) || 'rmf';
    const slug = `${shortName}-${slugId()}`;

    return this.linkModel.create({
      affiliateUserId: userId,
      productId: product._id,
      sellerId: product.sellerId,
      slug,
      commissionRate,
      commissionType: 'percent',
      status: 'active',
      approvedAt: new Date(),
    });
  }

  async getEarnings(userId: string, page = 1, limit = 20): Promise<any> {
    const skip = (Math.max(1, page) - 1) * limit;
    const filter = { userId: new Types.ObjectId(userId), account: 'affiliate_commission' };
    const [items, total] = await Promise.all([
      this.ledgerModel.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit).lean().exec(),
      this.ledgerModel.countDocuments(filter),
    ]);
    return { items, total, page, limit };
  }

  /**
   * Resolve a referral slug → productId, and increment clickCount asynchronously.
   * Returns null if not found. Never throws on the click increment.
   */
  async resolveSlug(slug: string): Promise<{ productId: string } | null> {
    const link = await this.linkModel.findOne({ slug, status: 'active', deletedAt: null }).select('productId').lean().exec();
    if (!link) return null;
    this.linkModel.updateOne({ slug }, { $inc: { clickCount: 1 } }).catch(() => {});
    this.profileModel
      .updateOne({ userId: (link as any).affiliateUserId }, { $inc: { totalClicks: 1 } })
      .catch(() => {});
    return { productId: String(link.productId) };
  }
}
