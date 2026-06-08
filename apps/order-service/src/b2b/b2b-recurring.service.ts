import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { OrderStatus } from '@rmf/shared-types';

/**
 * B2B recurring order materialization (Feature 7). A daily cron creates Transactions from
 * due RecurringOrderTemplates (orderSource='b2b_recurring').
 */
@Injectable()
export class B2bRecurringService {
  private readonly logger = new Logger(B2bRecurringService.name);

  constructor(
    @InjectModel('RecurringOrderTemplate') private templateModel: Model<any>,
    @InjectModel('Transaction') private orderModel: Model<any>,
    @InjectModel('SellerProfile') private sellerModel: Model<any>,
  ) {}

  @Cron('0 5 * * *') // 05:00 daily
  async materializeDueTemplates(): Promise<{ processed: number }> {
    const now = new Date();
    const due = await this.templateModel.find({ isActive: true, deletedAt: null, nextRunAt: { $lte: now } }).exec();
    let processed = 0;

    for (const tpl of due) {
      try {
        await this.createOrderFromTemplate(tpl);
        const next = this.computeNext(tpl);
        await this.templateModel.findByIdAndUpdate(tpl._id, {
          $set: { lastRunAt: now, nextRunAt: next },
        });
        processed++;
      } catch (err: any) {
        this.logger.error(`Recurring template ${tpl._id} failed: ${err?.message}`);
      }
    }

    if (processed) this.logger.log(`Materialized ${processed} B2B recurring order(s).`);
    return { processed };
  }

  private computeNext(tpl: any): Date {
    const next = new Date();
    next.setHours(tpl.timeWindow?.hour ?? 6, tpl.timeWindow?.minute ?? 0, 0, 0);
    if (tpl.frequency === 'daily') {
      next.setDate(next.getDate() + 1);
    } else {
      next.setDate(next.getDate() + 7);
    }
    return next;
  }

  private async createOrderFromTemplate(tpl: any): Promise<void> {
    const seller = await this.sellerModel.findById(tpl.sellerId).select('userId stallId shopDetails stallName marketId').lean().exec();
    if (!seller) throw new Error('Seller not found for template');

    const products = (tpl.items || []).map((i: any) => ({
      productId: i.productId,
      name: i.name,
      unitPrice: Number(i.unitPrice) || 0,
      quantity: Number(i.quantity) || 1,
      unit: i.unit,
    }));
    const subtotal = products.reduce((sum: number, p: any) => sum + p.unitPrice * p.quantity, 0);
    const deliveryFee = 0;
    const platformCommission = Math.max(Math.round(subtotal * 0.015), 100);
    const orderNumber = `B2B-${String(tpl._id).slice(-6)}-${Date.now()}`;

    await this.orderModel.create({
      orderNumber,
      buyer: { userId: tpl.buyerUserId, fullName: 'B2B Account' },
      seller: {
        sellerId: seller._id,
        userId: seller.userId,
        fullName: seller.shopDetails?.name || seller.stallName || 'Seller',
        stallId: seller.stallId || 'B2B',
        marketId: seller.marketId,
      },
      products,
      financials: {
        subtotal,
        deliveryFee,
        platformCommission,
        gatewayFee: 0,
        totalAmount: subtotal + deliveryFee,
        sellerPayout: subtotal - platformCommission,
        riderPayout: 0,
      },
      payment: { method: tpl.billingMethod === 'INVOICE' ? 'INVOICE' : 'MOMO', status: 'pending' },
      status: OrderStatus.PLACED,
      orderSource: 'b2b_recurring',
    });
  }
}
