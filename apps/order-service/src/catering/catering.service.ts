import { Injectable, NotFoundException, BadRequestException, ForbiddenException, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import axios from 'axios';

/**
 * Catering Contracts (Feature 8). Institutions (verified B2B accounts) post briefs; sellers
 * bid; the institution awards a bid which spins up a weekly recurring order template.
 */
@Injectable()
export class CateringService {
  private readonly logger = new Logger(CateringService.name);

  constructor(
    @InjectModel('CateringBrief') private briefModel: Model<any>,
    @InjectModel('CateringBid') private bidModel: Model<any>,
    @InjectModel('B2BAccount') private b2bModel: Model<any>,
    @InjectModel('SellerProfile') private sellerModel: Model<any>,
    @InjectModel('RecurringOrderTemplate') private templateModel: Model<any>,
  ) {}

  private async getVerifiedAccount(userId: string): Promise<any> {
    const account = await this.b2bModel.findOne({ userId, deletedAt: null }).lean().exec();
    if (!account) throw new ForbiddenException('A verified B2B account is required');
    if (!account.isVerified) throw new ForbiddenException('Your B2B account must be verified first');
    return account;
  }

  async createBrief(userId: string, body: any): Promise<any> {
    const account = await this.getVerifiedAccount(userId);
    if (!body?.title || !body?.mealsPerWeek || !body?.budgetPerMeal || !body?.startDate || !body?.endDate) {
      throw new BadRequestException('title, mealsPerWeek, budgetPerMeal, startDate and endDate are required');
    }
    const brief = await this.briefModel.create({
      institutionId: account._id,
      buyerUserId: userId,
      title: String(body.title).slice(0, 200),
      description: body.description,
      mealsPerWeek: Number(body.mealsPerWeek),
      dietaryRequirements: Array.isArray(body.dietaryRequirements) ? body.dietaryRequirements : [],
      budgetPerMeal: Number(body.budgetPerMeal),
      startDate: new Date(body.startDate),
      endDate: new Date(body.endDate),
      deliveryAddress: body.deliveryAddress || {},
      status: 'open',
    });
    this.notifyNearbySellers(brief);
    return brief;
  }

  async listBriefs(userId: string, role: string, status?: string): Promise<any[]> {
    const isSeller = String(role).toUpperCase() === 'SELLER';
    if (isSeller) {
      // Sellers see open briefs only.
      const q: any = { status: status || 'open', deletedAt: null };
      return this.briefModel.find(q).sort({ createdAt: -1 }).lean().exec();
    }
    // Institutions see their own briefs.
    const q: any = { buyerUserId: userId, deletedAt: null };
    if (status) q.status = status;
    return this.briefModel.find(q).sort({ createdAt: -1 }).lean().exec();
  }

  async getBrief(id: string, userId: string, role: string): Promise<any> {
    const brief = await this.briefModel.findById(id).lean().exec();
    if (!brief) throw new NotFoundException('Brief not found');

    const isOwner = String(brief.buyerUserId) === String(userId);
    // Bids are visible only to the brief owner.
    let bids: any[] = [];
    if (isOwner || String(role).toUpperCase() === 'ADMIN') {
      bids = await this.bidModel.find({ briefId: brief._id, deletedAt: null }).sort({ createdAt: -1 }).lean().exec();
    }
    return { ...brief, bids };
  }

  async submitBid(briefId: string, sellerUserId: string, body: any): Promise<any> {
    const brief = await this.briefModel.findById(briefId).lean().exec();
    if (!brief) throw new NotFoundException('Brief not found');
    if (brief.status !== 'open' && brief.status !== 'bidding') {
      throw new BadRequestException('This brief is no longer accepting bids');
    }
    const seller = await this.sellerModel.findOne({ userId: sellerUserId, deletedAt: null }).select('_id').lean().exec();
    if (!seller) throw new NotFoundException('Seller profile not found');
    if (!body?.pricePerMeal) throw new BadRequestException('pricePerMeal is required');

    const pricePerMeal = Number(body.pricePerMeal);
    const totalWeeklyPrice = pricePerMeal * Number(brief.mealsPerWeek || 0);

    const bid = await this.bidModel.create({
      briefId: brief._id,
      sellerId: seller._id,
      sellerUserId,
      proposedMenu: Array.isArray(body.proposedMenu) ? body.proposedMenu : [],
      pricePerMeal,
      totalWeeklyPrice,
      notes: body.notes,
      status: 'pending',
      submittedAt: new Date(),
    });

    await this.briefModel.findByIdAndUpdate(brief._id, { $set: { status: 'bidding' } });
    this.notify(String(brief.buyerUserId), 'catering.new_bid', { briefId: String(brief._id) });
    return bid;
  }

  async awardBid(briefId: string, bidId: string, userId: string): Promise<any> {
    const brief = await this.briefModel.findById(briefId);
    if (!brief) throw new NotFoundException('Brief not found');
    if (String(brief.buyerUserId) !== String(userId)) {
      throw new ForbiddenException('Only the brief owner can award');
    }
    if (brief.status === 'awarded') throw new BadRequestException('This brief has already been awarded');

    const winningBid = await this.bidModel.findOne({ _id: bidId, briefId: brief._id });
    if (!winningBid) throw new NotFoundException('Bid not found for this brief');

    brief.status = 'awarded';
    brief.awardedSellerId = winningBid.sellerId;
    brief.awardedBidId = winningBid._id;
    brief.awardedAt = new Date();
    await brief.save();

    winningBid.status = 'accepted';
    winningBid.respondedAt = new Date();
    await winningBid.save();

    await this.bidModel.updateMany(
      { briefId: brief._id, _id: { $ne: winningBid._id } },
      { $set: { status: 'rejected', respondedAt: new Date() } },
    );

    // Spin up a weekly recurring order template for the awarded seller.
    try {
      const seller = await this.sellerModel.findById(winningBid.sellerId).select('marketId').lean().exec();
      await this.templateModel.create({
        b2bAccountId: brief.institutionId,
        buyerUserId: brief.buyerUserId,
        sellerId: winningBid.sellerId,
        marketId: seller?.marketId,
        items: [{
          name: `Catering: ${brief.title}`,
          unitPrice: winningBid.pricePerMeal,
          quantity: brief.mealsPerWeek,
          unit: 'meal',
        }],
        frequency: 'weekly',
        dayOfWeek: 1,
        timeWindow: { hour: 6, minute: 0 },
        billingMethod: 'INVOICE',
        isActive: true,
        nextRunAt: this.nextMonday6am(),
      });
    } catch (err: any) {
      this.logger.error(`Failed to create catering recurring template: ${err?.message}`);
    }

    this.notify(String(winningBid.sellerUserId), 'catering.awarded', { briefId: String(brief._id) });
    return { success: true, briefId: String(brief._id), awardedBidId: String(winningBid._id) };
  }

  /** Cron: Monday 06:00 — activate awarded catering contracts whose start date has arrived. */
  @Cron('0 6 * * 1')
  async generateWeeklyCateringOrders(): Promise<{ processed: number }> {
    // Active catering contracts are materialized by the shared B2B recurring engine
    // (templates created on award). This hook activates briefs whose start date has arrived.
    const now = new Date();
    const toActivate = await this.briefModel.find({ status: 'awarded', startDate: { $lte: now }, endDate: { $gt: now }, deletedAt: null }).exec();
    for (const b of toActivate) {
      b.status = 'active';
      await b.save();
    }
    return { processed: toActivate.length };
  }

  private nextMonday6am(): Date {
    const next = new Date();
    next.setHours(6, 0, 0, 0);
    const delta = (1 - next.getDay() + 7) % 7 || 7;
    next.setDate(next.getDate() + delta);
    return next;
  }

  private notifyNearbySellers(brief: any): void {
    // Best-effort area notification; concrete seller targeting is out of scope for the placeholder.
    this.notifyAdmins('catering.new_brief', { briefId: String(brief._id), title: brief.title });
  }

  private notify(userId: string, type: string, params: any): void {
    const url = `${process.env.NOTIFICATION_SERVICE_URL || 'http://localhost:3009/api/v1'}/notifications/dispatch`;
    const secret = process.env.INTERNAL_SERVICE_SECRET;
    const headers = secret ? { 'x-internal-service-key': secret } : {};
    axios.post(url, { userId, type, params, channels: ['IN_APP'] }, { headers }).catch(() => {});
  }

  private notifyAdmins(type: string, params: any): void {
    const url = `${process.env.NOTIFICATION_SERVICE_URL || 'http://localhost:3009/api/v1'}/notifications/admin-notify`;
    const secret = process.env.INTERNAL_SERVICE_SECRET;
    const headers = secret ? { 'x-internal-service-key': secret } : {};
    axios.post(url, { type, params }, { headers }).catch(() => {});
  }
}
