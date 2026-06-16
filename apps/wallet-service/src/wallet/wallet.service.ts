import {
  Injectable,
  Logger,
  BadRequestException,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import axios from 'axios';

const MIN_WITHDRAWAL_RWF = 500;

@Injectable()
export class WalletService {
  private readonly logger = new Logger(WalletService.name);

  // In-memory PayPack access token cache
  private paypackToken?: { token: string; expiresAt: number };

  constructor(
    @InjectModel('Wallet') private walletModel: Model<any>,
    @InjectModel('LedgerEntry') private ledgerModel: Model<any>,
    @InjectModel('PayoutRequest') private payoutRequestModel: Model<any>,
  ) {}

  // ─────────────────────────────────────────────────────────────
  // INTERNAL: Called by order-service after delivery is confirmed
  // Credits seller and rider wallets — no PayPack cashout here
  // ─────────────────────────────────────────────────────────────
  async creditWallet(input: {
    userId: string;
    role: 'SELLER' | 'RIDER';
    amount: number;
    orderId: string;
    orderNumber: string;
    description: string;
  }): Promise<void> {
    const amount = Math.round(Number(input.amount || 0));
    if (amount <= 0) return;

    const userObjectId = new Types.ObjectId(input.userId);

    // Upsert wallet — create if first time earning
    await this.walletModel.findOneAndUpdate(
      { userId: userObjectId },
      {
        $setOnInsert: { role: input.role, currency: 'RWF' },
        $inc: {
          availableBalance: amount,
          totalEarned: amount,
          balance: amount, // keep legacy field in sync
        },
      },
      { upsert: true, new: true },
    );

    // Record ledger credit entry
    await new this.ledgerModel({
      userId: userObjectId,
      transactionId: new Types.ObjectId(input.orderId),
      type: 'credit',
      account: `${input.role.toLowerCase()}_wallet_credit`,
      amount,
      currency: 'RWF',
      description: input.description,
      balanceAfter: 0, // updated below
      provider: 'internal',
      status: 'posted',
      metadata: { orderNumber: input.orderNumber, role: input.role },
    }).save();

    this.logger.log(
      `[Wallet] Credited ${amount} RWF to ${input.role} wallet for user ${input.userId} (order ${input.orderNumber})`,
    );
  }

  // ─────────────────────────────────────────────────────────────
  // PUBLIC: GET /wallet/balance
  // ─────────────────────────────────────────────────────────────
  async getBalance(userId: string): Promise<any> {
    const wallet = await this.walletModel
      .findOne({ userId: new Types.ObjectId(userId) })
      .lean()
      .exec();

    if (!wallet) {
      return {
        userId,
        availableBalance: 0,
        pendingBalance: 0,
        totalEarned: 0,
        totalWithdrawn: 0,
        currency: 'RWF',
      };
    }

    return {
      userId,
      availableBalance: wallet.availableBalance ?? wallet.balance ?? 0,
      pendingBalance: wallet.pendingBalance ?? 0,
      totalEarned: wallet.totalEarned ?? wallet.totalEarnings ?? 0,
      totalWithdrawn: wallet.totalWithdrawn ?? 0,
      currency: wallet.currency ?? 'RWF',
      role: wallet.role,
    };
  }

  // ─────────────────────────────────────────────────────────────
  // PUBLIC: GET /wallet/transactions
  // ─────────────────────────────────────────────────────────────
  async getTransactions(
    userId: string,
    page = 1,
    limit = 20,
  ): Promise<any> {
    const skip = (page - 1) * limit;
    const userObjectId = new Types.ObjectId(userId);

    const [credits, withdrawals, total] = await Promise.all([
      this.ledgerModel
        .find({ userId: userObjectId })
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean()
        .exec(),
      this.payoutRequestModel
        .find({ userId: userObjectId })
        .sort({ requestedAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean()
        .exec(),
      this.ledgerModel.countDocuments({ userId: userObjectId }),
    ]);

    // Merge and sort by date descending
    const merged = [
      ...credits.map((e: any) => ({ ...e, _kind: 'credit' })),
      ...withdrawals.map((e: any) => ({ ...e, _kind: 'withdrawal' })),
    ].sort((a, b) => {
      const dateA = new Date(a.createdAt || a.requestedAt).getTime();
      const dateB = new Date(b.createdAt || b.requestedAt).getTime();
      return dateB - dateA;
    });

    return { transactions: merged, total, page, limit };
  }

  // ─────────────────────────────────────────────────────────────
  // PUBLIC: POST /wallet/withdraw
  // body: { amount: number, momo_number: string }
  // ─────────────────────────────────────────────────────────────
  async requestWithdrawal(
    userId: string,
    role: string,
    amount: number,
    momoNumber: string,
  ): Promise<any> {
    // ── Validation ──
    const normalizedRole = String(role || '').toUpperCase();
    if (!['SELLER', 'RIDER'].includes(normalizedRole)) {
      throw new ForbiddenException('Only sellers and riders can withdraw from their wallet');
    }

    const amountRwf = Math.round(Number(amount));
    if (!amountRwf || amountRwf < MIN_WITHDRAWAL_RWF) {
      throw new BadRequestException(`Minimum withdrawal amount is ${MIN_WITHDRAWAL_RWF} RWF`);
    }

    const normalizedPhone = this.normalizePhone(momoNumber);
    if (!normalizedPhone) {
      throw new BadRequestException('Provide a valid Rwanda MoMo number (07xxxxxxxx or +25078xxxxxxxx)');
    }

    // ── Lock funds atomically ──
    // The balance condition lives inside the update filter so two concurrent
    // withdrawals can never both pass a separate read-then-check (double spend).
    const userObjectId = new Types.ObjectId(userId);
    const lockedWallet = await this.walletModel.findOneAndUpdate(
      { userId: userObjectId, availableBalance: { $gte: amountRwf } },
      { $inc: { availableBalance: -amountRwf, pendingBalance: amountRwf } },
      { new: true },
    );

    if (!lockedWallet) {
      const wallet = await this.walletModel.findOne({ userId: userObjectId }).lean().exec();
      const available = wallet ? (wallet.availableBalance ?? wallet.balance ?? 0) : 0;
      throw new BadRequestException(
        `Insufficient balance. Available: ${available} RWF, Requested: ${amountRwf} RWF`,
      );
    }

    // ── Create withdrawal request ──
    const withdrawalRequest = await new this.payoutRequestModel({
      userId: userObjectId,
      role: normalizedRole,
      amount: amountRwf,
      momoNumber: normalizedPhone,
      recipientPhone: normalizedPhone, // legacy compat
      status: 'PENDING',
      requestedAt: new Date(),
    }).save();

    // ── Call PayPack cashout ──
    try {
      const paypackRef = await this.callPaypackCashout(amountRwf, normalizedPhone, String(withdrawalRequest._id));

      // ── Success: mark completed, release pending ──
      await this.walletModel.findOneAndUpdate(
        { userId: userObjectId },
        {
          $inc: {
            pendingBalance: -amountRwf,
            totalWithdrawn: amountRwf,
            balance: -amountRwf, // legacy sync
          },
        },
      );

      await this.payoutRequestModel.findByIdAndUpdate(withdrawalRequest._id, {
        $set: {
          status: 'COMPLETED',
          paypackRef,
          gatewayRef: paypackRef, // legacy compat
          settledAt: new Date(),
          processedAt: new Date(),
        },
      });

      // ── Record ledger debit ──
      await new this.ledgerModel({
        userId: userObjectId,
        type: 'debit',
        account: 'wallet_withdrawal',
        amount: amountRwf,
        currency: 'RWF',
        description: `Withdrawal of ${amountRwf} RWF to ${normalizedPhone}`,
        balanceAfter: 0,
        provider: 'paypack',
        externalRef: paypackRef,
        status: 'posted',
        metadata: { withdrawalRequestId: withdrawalRequest._id, role: normalizedRole },
      }).save();

      this.logger.log(
        `[Wallet] Withdrawal of ${amountRwf} RWF completed for ${normalizedRole} ${userId}. PayPack ref: ${paypackRef}`,
      );

      return {
        success: true,
        message: `${amountRwf} RWF is being sent to ${normalizedPhone}`,
        paypackRef,
        status: 'COMPLETED',
      };
    } catch (err: any) {
      // ── Failure: restore available balance, clear pending ──
      await this.walletModel.findOneAndUpdate(
        { userId: userObjectId },
        { $inc: { availableBalance: amountRwf, pendingBalance: -amountRwf } },
      );

      await this.payoutRequestModel.findByIdAndUpdate(withdrawalRequest._id, {
        $set: { status: 'FAILED', failureReason: err.message },
      });

      this.logger.error(`[Wallet] Withdrawal failed for user ${userId}: ${err.message}`);
      throw new BadRequestException(`Withdrawal failed: ${err.message}`);
    }
  }

  // ─────────────────────────────────────────────────────────────
  // PAYPACK: Get access token (cached)
  // ─────────────────────────────────────────────────────────────
  private async getPaypackToken(): Promise<string> {
    if (this.paypackToken && this.paypackToken.expiresAt > Date.now() + 10_000) {
      return this.paypackToken.token;
    }

    const baseUrl = process.env.PAYPACK_BASE_URL || 'https://payments.paypack.rw/api';
    const res = await axios.post(`${baseUrl}/auth/agents/authorize`, {
      client_id: process.env.PAYPACK_CLIENT_ID,
      client_secret: process.env.PAYPACK_CLIENT_SECRET,
    });

    const token = res.data?.access || res.data?.token;
    const expiresIn = Number(res.data?.expires || 3600);
    if (!token) throw new Error('PayPack did not return an access token');

    this.paypackToken = { token, expiresAt: Date.now() + (expiresIn - 60) * 1000 };
    return token;
  }

  // ─────────────────────────────────────────────────────────────
  // PAYPACK: Cash-out (disburse to phone)
  // ─────────────────────────────────────────────────────────────
  private async callPaypackCashout(
    amount: number,
    phone: string,
    idempotencyKey: string,
  ): Promise<string> {
    const baseUrl = process.env.PAYPACK_BASE_URL || 'https://payments.paypack.rw/api';
    const webhookMode = process.env.PAYPACK_WEBHOOK_MODE || 'development';
    const token = await this.getPaypackToken();

    const res = await axios.post(
      `${baseUrl}/transactions/cashout`,
      { amount, number: phone, environment: webhookMode },
      {
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
          'Idempotency-Key': idempotencyKey,
          'X-Webhook-Mode': webhookMode,
        },
        timeout: 20_000,
      },
    );

    const ref = res.data?.ref || res.data?.data?.ref || res.data?.reference;
    if (!ref) throw new Error('PayPack cashout did not return a transaction reference');
    return String(ref);
  }

  // ─────────────────────────────────────────────────────────────
  // HELPERS
  // ─────────────────────────────────────────────────────────────
  private normalizePhone(raw: string): string | null {
    if (!raw) return null;
    let phone = String(raw).replace(/\s+/g, '').replace(/-/g, '');
    if (phone.startsWith('+250')) phone = '0' + phone.slice(4);
    if (phone.startsWith('250')) phone = '0' + phone.slice(3);
    if (/^07\d{8}$/.test(phone)) return phone;
    return null;
  }

  // ─────────────────────────────────────────────────────────────
  // LEGACY stubs — kept so old routes don't crash
  // ─────────────────────────────────────────────────────────────
  async createWallet(userId: string): Promise<any> {
    // auto-create wallets on first credit instead; this is a no-op
    return { userId, message: 'Wallet will be created automatically on first earning' };
  }

  async deposit(_userId: string, _amount: number, _method: string, _phone?: string): Promise<any> {
    throw new BadRequestException('Direct deposits are disabled. Funds are credited automatically after order delivery.');
  }

  async processTransaction(_data: any): Promise<any> {
    throw new BadRequestException('Use POST /wallet/withdraw for disbursements.');
  }

  async deductWeeklyInsurance(): Promise<any> {
    throw new BadRequestException('Insurance deductions are disabled.');
  }

  async requestPayout(userId: string, amount: number, _method: string, recipientPhone: string): Promise<any> {
    // Legacy route — delegate to new withdrawal flow.
    // Use the wallet's recorded role (set on first credit); hardcoding 'SELLER'
    // here would let non-earning roles bypass the SELLER/RIDER restriction.
    const wallet = await this.walletModel.findOne({ userId: new Types.ObjectId(userId) }).lean().exec();
    const role = String((wallet as any)?.role || '').toUpperCase();
    if (!['SELLER', 'RIDER'].includes(role)) {
      throw new ForbiddenException('Only sellers and riders can withdraw from their wallet');
    }
    return this.requestWithdrawal(userId, role, amount, recipientPhone);
  }

  async completePayout(_payoutId: string): Promise<any> {
    throw new BadRequestException('Payouts are now processed automatically via PayPack.');
  }

  async failPayout(_payoutId: string, _reason: string): Promise<any> {
    throw new BadRequestException('Payout failure handling is automatic.');
  }

  async getAllPayoutRequests(): Promise<any> {
    return this.payoutRequestModel.find({}).sort({ createdAt: -1 }).exec();
  }

  async getTransactionsLegacy(userId: string): Promise<any> {
    return this.ledgerModel.find({ userId: new Types.ObjectId(userId) }).sort({ createdAt: -1 }).limit(50).exec();
  }
}
