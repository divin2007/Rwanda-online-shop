import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import axios from 'axios';
import { PaymentService } from './payment.service';

@Injectable()
export class BuyerProtectionService {
  private readonly logger = new Logger(BuyerProtectionService.name);

  constructor(
    @InjectModel('LedgerEntry') private ledgerModel: Model<any>,
    private readonly paymentService: PaymentService,
  ) {}

  async executeInstantRefund(order: any, amount: number, reason = 'Buyer protection refund') {
    const orderId = this.normalizeId(order?._id || order?.id || order);
    const buyerId = this.normalizeId(order?.buyer?.userId || order?.buyerId);
    const buyerPhone = order?.buyer?.phone;
    const refundAmount = Math.round(Number(amount || 0));

    if (!orderId || !Types.ObjectId.isValid(orderId)) {
      throw new BadRequestException('A valid order id is required for refund processing');
    }
    if (!buyerId) {
      throw new BadRequestException('Buyer id is required for refund processing');
    }
    if (!buyerPhone) {
      throw new BadRequestException('Buyer mobile money number is required for Paypack refund');
    }
    if (!refundAmount || refundAmount <= 0) {
      throw new BadRequestException('Refund amount must be greater than zero');
    }

    const transactionId = new Types.ObjectId(orderId);
    const existingRefund = await this.ledgerModel.findOne({
      transactionId,
      account: 'buyer_paypack_refund',
    }).lean().exec();

    if (existingRefund) {
      this.logger.log(`Skipping duplicate refund for order ${orderId}; already recorded as ${existingRefund.externalRef || 'processed'}.`);
      return {
        success: true,
        processedVia: 'paypack_cashout',
        amount: refundAmount,
        transactionRef: existingRefund.externalRef,
        duplicate: true,
      };
    }

    this.logger.log(`Executing Paypack refund cashout for order ${orderId} from BPF accounting reserve...`);

    const refund = await this.paymentService.requestPaypackRefund({
      amount: refundAmount,
      phone: buyerPhone,
      idempotencyKey: `refund:${orderId}:${refundAmount}`,
      originalTransactionRef: order?.payment?.transactionRef,
    });

    if (!refund.success) {
      await this.recordLedgerEntry({
        transactionId,
        userId: buyerId,
        type: 'debit',
        account: 'buyer_protection_refund_failed',
        amount: refundAmount,
        description: `Failed Paypack refund for order ${orderId}: ${refund.error || 'Unknown Paypack error'}`,
        externalRef: refund.transactionId,
        status: 'failed',
        metadata: { orderNumber: order?.orderNumber, reason, error: refund.error },
      });
      throw new BadRequestException(refund.error || 'Paypack refund failed');
    }

    await this.recordLedgerEntry({
      transactionId,
      type: 'debit',
      account: 'buyer_protection_reserve_accounting',
      amount: refundAmount,
      description: `BPF accounting reserve used for refund on order ${orderId}`,
      externalRef: refund.transactionId,
      status: 'posted',
      metadata: { orderNumber: order?.orderNumber, reason },
    });

    await this.recordLedgerEntry({
      transactionId,
      userId: buyerId,
      type: 'credit',
      account: 'buyer_paypack_refund',
      amount: refundAmount,
      description: `Paypack refund cashout to buyer for order ${orderId}`,
      externalRef: refund.transactionId,
      status: 'posted',
      metadata: { orderNumber: order?.orderNumber, reason, phoneLast4: String(buyerPhone).slice(-4) },
    });

    const notificationUrl = process.env.NOTIFICATION_SERVICE_URL || 'http://localhost:3009/api/v1';
    const secret = process.env.INTERNAL_SERVICE_SECRET;
    const headers = secret ? { 'x-internal-service-key': secret } : {};

    await axios.post(`${notificationUrl}/notifications/dispatch`, {
      userId: buyerId,
      type: 'refund.processed',
      params: { orderId, amount: refundAmount, referenceType: 'Order', transactionRef: refund.transactionId },
      channels: ['IN_APP', 'EMAIL', 'SMS'],
    }, { headers }).catch(error => {
      this.logger.warn(`Refund notification failed for ${buyerId}: ${error.message}`);
    });

    this.logger.log(`Refund of ${refundAmount} RWF sent to buyer ${buyerId} through Paypack.`);
    return { success: true, processedVia: 'paypack_cashout', amount: refundAmount, transactionRef: refund.transactionId };
  }

  async escalateForManualReview(orderId: string, amount: number) {
    this.logger.log(`Escalating dispute for order ${orderId} (${amount} RWF) for manual Admin review.`);
    
    const notificationUrl = process.env.NOTIFICATION_SERVICE_URL || 'http://localhost:3009/api/v1';
    const secret = process.env.INTERNAL_SERVICE_SECRET;
    const headers = secret ? { 'x-internal-service-key': secret } : {};

    await axios.post(`${notificationUrl}/notifications/in-app`, {
      userId: process.env.ADMIN_USER_ID,
      type: 'dispute.manual_review',
      params: { orderId, amount, referenceType: 'Order' }
    }, { headers }).catch(error => {
      this.logger.warn(`Manual review notification failed: ${error.message}`);
    });

    return { success: true, escalated: true };
  }

  // Seed the buyer protection reserve as accounting only.
  // Called from processPaymentCallback when payment status is PAID.
  async seedReserveFromCommission(orderId: string, financialsOrCommission: any) {
    const financials = typeof financialsOrCommission === 'object' ? financialsOrCommission : null;
    const platformCommission = Number(financials?.platformCommission ?? financialsOrCommission ?? 0);
    const explicitBpfFee = Number(
      financials?.buyerProtectionFee ??
      financials?.bpfFee ??
      financials?.protectionFee ??
      0
    );
    const contribution = Math.round(explicitBpfFee > 0 ? explicitBpfFee : platformCommission * 0.01);
    if (contribution <= 0) return;

    try {
      if (!Types.ObjectId.isValid(orderId)) {
        throw new Error('Invalid order id for BPF reserve ledger');
      }

      const transactionId = new Types.ObjectId(orderId);
      const existing = await this.ledgerModel.findOne({
        transactionId,
        account: 'buyer_protection_reserve_accounting',
        type: 'credit',
      }).lean().exec();

      if (existing) return;

      await this.recordLedgerEntry({
        transactionId,
        type: 'credit',
        account: 'buyer_protection_reserve_accounting',
        amount: contribution,
        description: `BPF accounting reserve contribution from order ${orderId}`,
        status: 'posted',
        metadata: {
          platformCommission,
          explicitBpfFee: explicitBpfFee || undefined,
          contributionRate: explicitBpfFee > 0 ? undefined : 0.01,
        },
      });

      this.logger.log(`BPF reserve accounting seeded with ${contribution} RWF from order ${orderId}`);
    } catch (error: any) {
      this.logger.warn(`Failed to seed reserve fund from order ${orderId}: ${error.message}`);
    }
  }

  private normalizeId(value: any): string | null {
    if (value === null || value === undefined) return null;
    if (typeof value === 'string') return value;
    if (typeof value.toHexString === 'function') return value.toHexString();
    if (value._id !== undefined && value._id !== value) return this.normalizeId(value._id);
    return String(value);
  }

  private async recordLedgerEntry(input: {
    transactionId: Types.ObjectId;
    userId?: string | null;
    type: 'credit' | 'debit';
    account: string;
    amount: number;
    description: string;
    externalRef?: string;
    status?: string;
    metadata?: Record<string, any>;
  }) {
    const balanceAfter = await this.calculateAccountBalanceAfter(input.account, input.type, input.amount);
    return new this.ledgerModel({
      ledgerId: `BPF-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      userId: input.userId && Types.ObjectId.isValid(input.userId) ? new Types.ObjectId(input.userId) : undefined,
      transactionId: input.transactionId,
      type: input.type,
      account: input.account,
      amount: input.amount,
      currency: 'RWF',
      description: input.description,
      balanceAfter,
      provider: 'paypack',
      externalRef: input.externalRef,
      status: input.status || 'posted',
      metadata: input.metadata,
    }).save();
  }

  private async calculateAccountBalanceAfter(account: string, type: 'credit' | 'debit', amount: number): Promise<number> {
    const [summary] = await this.ledgerModel.aggregate([
      { $match: { account } },
      {
        $group: {
          _id: '$account',
          balance: {
            $sum: {
              $cond: [{ $eq: ['$type', 'credit'] }, '$amount', { $multiply: ['$amount', -1] }],
            },
          },
        },
      },
    ]);
    const current = Number(summary?.balance || 0);
    return current + (type === 'credit' ? amount : -amount);
  }
}
