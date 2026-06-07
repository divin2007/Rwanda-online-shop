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
import * as crypto from 'crypto';

const MIN_WITHDRAWAL_RWF = 500;

// Disbursement status poller tuning.
const POLL_INTERVAL_MS = 30_000;
const POLL_MAX_ATTEMPTS = 10;

@Injectable()
export class WalletService {
  private readonly logger = new Logger(WalletService.name);

  // In-memory MTN Disbursement access token cache.
  private disbursementToken?: { token: string; expiresAt: number };

  constructor(
    @InjectModel('Wallet') private walletModel: Model<any>,
    @InjectModel('LedgerEntry') private ledgerModel: Model<any>,
    @InjectModel('PayoutRequest') private payoutRequestModel: Model<any>,
  ) {}

  // ─────────────────────────────────────────────────────────────
  // INTERNAL: Called by order-service after delivery is confirmed
  // Credits seller and rider internal wallet balances. No external transfer here.
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

    // Upsert wallet — create if first time earning. `new: true` returns the
    // post-increment document so we can record an accurate balanceAfter.
    const updatedWallet = await this.walletModel.findOneAndUpdate(
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

    const balanceAfter = Number(updatedWallet?.availableBalance ?? updatedWallet?.balance ?? amount);

    // Record ledger credit entry
    await new this.ledgerModel({
      ledgerId: this.newLedgerId('CRD'),
      userId: userObjectId,
      transactionId: new Types.ObjectId(input.orderId),
      type: 'credit',
      account: `${input.role.toLowerCase()}_wallet_credit`,
      amount,
      currency: 'RWF',
      description: input.description,
      balanceAfter,
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

    const userObjectId = new Types.ObjectId(userId);

    // ── Atomic debit (P2: no double-spend) ──
    // The $gte pre-condition + $inc in a single findOneAndUpdate guarantees that two
    // concurrent withdrawals cannot both pass the balance check. If the document does
    // not match (insufficient balance), updated is null and we reject.
    const debited = await this.walletModel.findOneAndUpdate(
      { userId: userObjectId, availableBalance: { $gte: amountRwf } },
      {
        $inc: { availableBalance: -amountRwf, pendingBalance: amountRwf },
        $set: { updatedAt: new Date() },
      },
      { new: true },
    ).exec();

    if (!debited) {
      throw new BadRequestException('Insufficient balance or concurrent withdrawal in progress');
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

    // ── Call MTN MoMo disbursement (Transfer) ──
    let gatewayRef: string;
    try {
      gatewayRef = await this.callMtnDisbursement(amountRwf, normalizedPhone, String(withdrawalRequest._id));
    } catch (err: any) {
      // Initiation failed before MTN accepted the transfer: reverse the debit fully.
      await this.walletModel.findOneAndUpdate(
        { userId: userObjectId },
        { $inc: { availableBalance: amountRwf, pendingBalance: -amountRwf } },
      ).exec();

      await this.payoutRequestModel.findByIdAndUpdate(withdrawalRequest._id, {
        $set: { status: 'FAILED', failureReason: err.message },
      }).exec();

      this.logger.error(`[Wallet] Withdrawal initiation failed for user ${userId}: ${err.message}`);
      throw new BadRequestException(`Withdrawal failed: ${err.message}`);
    }

    // ── MTN accepted (202). Funds remain in pendingBalance. Mark PROCESSING (P3) ──
    // The money is NOT settled yet — only confirmed once the poller sees SUCCESSFUL.
    await this.payoutRequestModel.findByIdAndUpdate(withdrawalRequest._id, {
      $set: {
        status: 'PROCESSING',
        gatewayRef,
        processedAt: new Date(),
      },
    }).exec();

    // ── Record ledger debit (pending until the transfer confirms) ──
    await new this.ledgerModel({
      ledgerId: this.newLedgerId('WTH'),
      userId: userObjectId,
      type: 'debit',
      account: 'wallet_withdrawal',
      amount: amountRwf,
      currency: 'RWF',
      description: `Withdrawal of ${amountRwf} RWF to ${normalizedPhone}`,
      balanceAfter: Number(debited.availableBalance ?? 0),
      provider: 'mtn_momo',
      externalRef: gatewayRef,
      status: 'pending',
      metadata: { withdrawalRequestId: withdrawalRequest._id, role: normalizedRole },
    }).save();

    // ── Poll MTN for the final transfer result in the background ──
    this.addWithdrawalStatusPoller(gatewayRef, String(withdrawalRequest._id), userId, amountRwf);

    this.logger.log(
      `[Wallet] Withdrawal of ${amountRwf} RWF is PROCESSING for ${normalizedRole} ${userId}. MTN ref: ${gatewayRef}`,
    );

    return {
      success: true,
      message: `${amountRwf} RWF is being sent to ${normalizedPhone}`,
      gatewayRef,
      status: 'PROCESSING',
    };
  }

  // ─────────────────────────────────────────────────────────────
  // Background poller: confirm the MTN transfer, then settle or reverse.
  // SUCCESSFUL → payout COMPLETED, drain pendingBalance, bump totalWithdrawn.
  // FAILED     → payout FAILED, return funds to availableBalance.
  // Timeout (still PENDING after max attempts) → leave PROCESSING for manual/admin review.
  // ─────────────────────────────────────────────────────────────
  addWithdrawalStatusPoller(
    referenceId: string,
    payoutRequestId: string,
    userId: string,
    amount: number,
  ): void {
    const userObjectId = new Types.ObjectId(userId);
    let attempts = 0;

    const settleSuccess = async () => {
      await this.walletModel.findOneAndUpdate(
        { userId: userObjectId },
        {
          $inc: {
            pendingBalance: -amount,
            totalWithdrawn: amount,
            balance: -amount, // legacy sync
          },
        },
      ).exec();
      await this.payoutRequestModel.findByIdAndUpdate(payoutRequestId, {
        $set: { status: 'COMPLETED', settledAt: new Date() },
      }).exec();
      await this.ledgerModel.updateOne(
        { externalRef: referenceId, account: 'wallet_withdrawal' },
        { $set: { status: 'posted' } },
      ).exec();
      this.logger.log(`[Wallet] Withdrawal ${payoutRequestId} settled (MTN ref ${referenceId}).`);
    };

    const reverseFailure = async (reason: string) => {
      // Return the locked funds to available; remove from pending.
      await this.walletModel.findOneAndUpdate(
        { userId: userObjectId },
        { $inc: { availableBalance: amount, pendingBalance: -amount } },
      ).exec();
      await this.payoutRequestModel.findByIdAndUpdate(payoutRequestId, {
        $set: { status: 'FAILED', failureReason: reason },
      }).exec();
      await this.ledgerModel.updateOne(
        { externalRef: referenceId, account: 'wallet_withdrawal' },
        { $set: { status: 'failed' } },
      ).exec();
      this.logger.warn(`[Wallet] Withdrawal ${payoutRequestId} reversed (MTN ref ${referenceId}): ${reason}`);
    };

    const poll = setInterval(async () => {
      attempts += 1;
      try {
        const status = await this.getMtnDisbursementStatus(referenceId);
        if (status === 'SUCCESSFUL') {
          clearInterval(poll);
          await settleSuccess();
        } else if (status === 'FAILED') {
          clearInterval(poll);
          await reverseFailure('MTN reported the transfer as FAILED');
        } else if (attempts >= POLL_MAX_ATTEMPTS) {
          clearInterval(poll);
          this.logger.warn(
            `[Wallet] Withdrawal ${payoutRequestId} still PENDING after ${attempts} polls; leaving PROCESSING for review (MTN ref ${referenceId}).`,
          );
        }
      } catch (err: any) {
        if (attempts >= POLL_MAX_ATTEMPTS) {
          clearInterval(poll);
          this.logger.error(
            `[Wallet] Poller gave up for withdrawal ${payoutRequestId} (MTN ref ${referenceId}): ${err.message}. Left PROCESSING for review.`,
          );
        }
      }
    }, POLL_INTERVAL_MS);

    // Don't keep the event loop alive solely for this timer.
    if (typeof poll.unref === 'function') poll.unref();
  }

  // ─────────────────────────────────────────────────────────────
  // MTN MoMo Disbursement config / helpers
  // ─────────────────────────────────────────────────────────────
  private get mtnBaseUrl(): string {
    if (process.env.MTN_MOMO_BASE_URL) return process.env.MTN_MOMO_BASE_URL;
    return process.env.MTN_MOMO_TARGET_ENV === 'sandbox'
      ? 'https://sandbox.momodeveloper.mtn.com'
      : 'https://proxy.momoapi.mtn.com';
  }

  private get mtnTargetEnv(): string {
    return process.env.MTN_MOMO_TARGET_ENV || 'mtnrwanda';
  }

  private get mtnCurrency(): string {
    return process.env.MTN_MOMO_CURRENCY || 'RWF';
  }

  // ─────────────────────────────────────────────────────────────
  // MTN: Get disbursement access token (cached ~1h)
  // ─────────────────────────────────────────────────────────────
  private async getDisbursementToken(): Promise<string> {
    if (this.disbursementToken && this.disbursementToken.expiresAt > Date.now() + 10_000) {
      return this.disbursementToken.token;
    }

    const auth = Buffer
      .from(`${process.env.MTN_MOMO_DISBURSEMENT_USER_ID}:${process.env.MTN_MOMO_DISBURSEMENT_API_SECRET}`)
      .toString('base64');

    const res = await axios.post(
      `${this.mtnBaseUrl}/disbursement/token/`,
      {},
      {
        headers: {
          Authorization: `Basic ${auth}`,
          'Ocp-Apim-Subscription-Key': process.env.MTN_MOMO_DISBURSEMENT_API_KEY,
        },
        timeout: 15_000,
      },
    );

    const token = res.data?.access_token;
    const expiresIn = Number(res.data?.expires_in || 3600);
    if (!token) throw new Error('MTN Disbursement did not return an access token');

    this.disbursementToken = { token, expiresAt: Date.now() + Math.max(expiresIn - 60, 60) * 1000 };
    return token;
  }

  // ─────────────────────────────────────────────────────────────
  // MTN: Transfer (disburse to phone). Returns the X-Reference-Id we set,
  // which is the gateway transaction reference. Idempotent on idempotencyKey.
  // ─────────────────────────────────────────────────────────────
  private async callMtnDisbursement(
    amount: number,
    phone: string,
    idempotencyKey: string,
  ): Promise<string> {
    const token = await this.getDisbursementToken();
    const referenceId = this.deterministicUuid(idempotencyKey);
    const partyId = this.toMsisdn(phone);

    await axios.post(
      `${this.mtnBaseUrl}/disbursement/v1_0/transfer`,
      {
        amount: String(amount),
        currency: this.mtnCurrency,
        externalId: idempotencyKey,
        payee: { partyIdType: 'MSISDN', partyId },
        payerMessage: 'Withdrawal from RMF wallet',
        payeeNote: 'Rwanda Marketplace payout',
      },
      {
        headers: {
          Authorization: `Bearer ${token}`,
          'X-Reference-Id': referenceId,
          'X-Target-Environment': this.mtnTargetEnv,
          'Content-Type': 'application/json',
          'Ocp-Apim-Subscription-Key': process.env.MTN_MOMO_DISBURSEMENT_API_KEY,
        },
        timeout: 20_000,
      },
    );

    return referenceId;
  }

  // ─────────────────────────────────────────────────────────────
  // MTN: Poll a transfer's status. Returns SUCCESSFUL | FAILED | PENDING | ERROR.
  // ─────────────────────────────────────────────────────────────
  private async getMtnDisbursementStatus(referenceId: string): Promise<string> {
    try {
      const token = await this.getDisbursementToken();
      const res = await axios.get(
        `${this.mtnBaseUrl}/disbursement/v1_0/transfer/${referenceId}`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
            'X-Target-Environment': this.mtnTargetEnv,
            'Ocp-Apim-Subscription-Key': process.env.MTN_MOMO_DISBURSEMENT_API_KEY,
          },
          timeout: 15_000,
        },
      );
      const value = String(res.data?.status || '').trim().toUpperCase();
      if (value === 'SUCCESSFUL') return 'SUCCESSFUL';
      if (value === 'FAILED') return 'FAILED';
      return 'PENDING';
    } catch (err: any) {
      this.logger.warn(`[Wallet] MTN status poll failed for ${referenceId}: ${err.message}`);
      return 'ERROR';
    }
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

  // Convert a normalized 07XXXXXXXX number to MTN MSISDN 2507XXXXXXXX.
  private toMsisdn(phone: string): string {
    const digits = String(phone).replace(/\D/g, '');
    if (digits.startsWith('2507') && digits.length === 12) return digits;
    if (digits.startsWith('07') && digits.length === 10) return '250' + digits.slice(1);
    if (digits.startsWith('7') && digits.length === 9) return '250' + digits;
    return digits;
  }

  private newLedgerId(prefix: string): string {
    return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  }

  // Stable UUIDv4-shaped value from a key so a retry reuses the same X-Reference-Id.
  private deterministicUuid(key: string): string {
    const hash = crypto.createHash('sha256').update(String(key)).digest('hex');
    return [
      hash.slice(0, 8),
      hash.slice(8, 12),
      '4' + hash.slice(13, 16),
      ((parseInt(hash.slice(16, 17), 16) & 0x3) | 0x8).toString(16) + hash.slice(17, 20),
      hash.slice(20, 32),
    ].join('-');
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
    // Legacy route — delegate to new withdrawal flow
    return this.requestWithdrawal(userId, 'SELLER', amount, recipientPhone);
  }

  async completePayout(_payoutId: string): Promise<any> {
    throw new BadRequestException('Payouts are now processed automatically via MTN MoMo.');
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
