import { Injectable, NotFoundException, BadRequestException, ForbiddenException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';

/**
 * B2B recurring order templates + invoice access (Feature 7).
 */
@Injectable()
export class B2bOrdersService {
  constructor(
    @InjectModel('RecurringOrderTemplate') private templateModel: Model<any>,
    @InjectModel('Invoice') private invoiceModel: Model<any>,
    @InjectModel('B2BAccount') private b2bModel: Model<any>,
    @InjectModel('SellerProfile') private sellerModel: Model<any>,
    @InjectModel('Product') private productModel: Model<any>,
  ) {}

  private async getVerifiedAccount(userId: string): Promise<any> {
    const account = await this.b2bModel.findOne({ userId, deletedAt: null }).lean().exec();
    if (!account) throw new ForbiddenException('A verified B2B account is required');
    if (!account.isVerified) throw new ForbiddenException('Your B2B account must be verified first');
    return account;
  }

  /** Compute the next run timestamp from frequency + dayOfWeek + timeWindow. */
  private computeNextRunAt(frequency: string, dayOfWeek?: number, timeWindow?: { hour?: number; minute?: number }): Date {
    const now = new Date();
    const next = new Date(now);
    next.setSeconds(0, 0);
    next.setHours(timeWindow?.hour ?? 6, timeWindow?.minute ?? 0, 0, 0);

    if (frequency === 'daily') {
      if (next <= now) next.setDate(next.getDate() + 1);
      return next;
    }
    // weekly
    const targetDow = Number.isFinite(dayOfWeek as number) ? (dayOfWeek as number) : 1;
    let delta = (targetDow - next.getDay() + 7) % 7;
    if (delta === 0 && next <= now) delta = 7;
    next.setDate(next.getDate() + delta);
    return next;
  }

  async createTemplate(userId: string, body: any): Promise<any> {
    const account = await this.getVerifiedAccount(userId);

    if (!body?.sellerId || !Types.ObjectId.isValid(body.sellerId)) {
      throw new BadRequestException('A valid sellerId is required');
    }
    const seller = await this.sellerModel.findById(body.sellerId).select('_id marketId').lean().exec();
    if (!seller) throw new NotFoundException('Seller not found');

    const items = Array.isArray(body.items) ? body.items : [];
    if (items.length === 0) throw new BadRequestException('At least one item is required');

    const frequency = body.frequency === 'daily' ? 'daily' : 'weekly';
    const nextRunAt = this.computeNextRunAt(frequency, body.dayOfWeek, body.timeWindow);

    return this.templateModel.create({
      b2bAccountId: account._id,
      buyerUserId: userId,
      sellerId: seller._id,
      marketId: seller.marketId,
      items: items.map((i: any) => ({
        productId: Types.ObjectId.isValid(i.productId) ? i.productId : undefined,
        name: i.name,
        unitPrice: Number(i.unitPrice) || 0,
        quantity: Number(i.quantity) || 1,
        unit: i.unit,
      })),
      frequency,
      dayOfWeek: body.dayOfWeek,
      timeWindow: body.timeWindow,
      billingMethod: ['MOMO', 'INVOICE'].includes(body.billingMethod) ? body.billingMethod : account.billingMethod || 'MOMO',
      isActive: true,
      nextRunAt,
    });
  }

  async listTemplates(userId: string): Promise<any[]> {
    return this.templateModel.find({ buyerUserId: userId, deletedAt: null }).sort({ createdAt: -1 }).lean().exec();
  }

  async updateTemplate(userId: string, id: string, body: any): Promise<any> {
    const tpl = await this.templateModel.findOne({ _id: id, buyerUserId: userId, deletedAt: null });
    if (!tpl) throw new NotFoundException('Template not found');

    if (Array.isArray(body.items)) tpl.items = body.items;
    if (body.frequency) tpl.frequency = body.frequency === 'daily' ? 'daily' : 'weekly';
    if (body.dayOfWeek !== undefined) tpl.dayOfWeek = body.dayOfWeek;
    if (body.timeWindow) tpl.timeWindow = body.timeWindow;
    if (typeof body.isActive === 'boolean') tpl.isActive = body.isActive;
    // Recompute next run when scheduling fields change.
    if (body.frequency || body.dayOfWeek !== undefined || body.timeWindow) {
      tpl.nextRunAt = this.computeNextRunAt(tpl.frequency, tpl.dayOfWeek, tpl.timeWindow);
    }
    await tpl.save();
    return tpl;
  }

  async deleteTemplate(userId: string, id: string): Promise<any> {
    const tpl = await this.templateModel.findOneAndUpdate(
      { _id: id, buyerUserId: userId, deletedAt: null },
      { $set: { deletedAt: new Date(), isActive: false } },
      { new: true },
    );
    if (!tpl) throw new NotFoundException('Template not found');
    return { success: true };
  }

  async listInvoices(userId: string): Promise<any[]> {
    return this.invoiceModel.find({ buyerUserId: userId, deletedAt: null }).sort({ createdAt: -1 }).lean().exec();
  }

  async getInvoice(userId: string, id: string): Promise<any> {
    const invoice = await this.invoiceModel.findOne({ _id: id, buyerUserId: userId, deletedAt: null }).lean().exec();
    if (!invoice) throw new NotFoundException('Invoice not found');
    return invoice;
  }

  async getInvoicePdf(userId: string, id: string): Promise<{ pdfUrl: string | null }> {
    const invoice = await this.getInvoice(userId, id);
    return { pdfUrl: invoice.pdfUrl || null };
  }
}
