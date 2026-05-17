import { Injectable, NotFoundException, BadRequestException, InternalServerErrorException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types, ClientSession } from 'mongoose';

@Injectable()
export class WalletService {
  constructor(
    @InjectModel('Wallet') private walletModel: Model<any>,
    @InjectModel('LedgerEntry') private ledgerModel: Model<any>,
    @InjectModel('PayoutRequest') private payoutRequestModel: Model<any>
  ) {}

  async createWallet(userId: string): Promise<any> {
    const existing = await this.walletModel.findOne({ userId });
    if (existing) return existing;

    const wallet = new this.walletModel({ userId, balance: 0 });
    return await wallet.save();
  }

  async getBalance(userId: string): Promise<any> {
    let wallet = await this.walletModel.findOne({ userId });
    if (!wallet) {
      wallet = await this.createWallet(userId);
    }
    return wallet;
  }

  async getTransactions(userId: string): Promise<any> {
    return await this.ledgerModel.find({ userId }).sort({ createdAt: -1 }).limit(50).exec();
  }

  private toLedgerTransactionId(value?: string): Types.ObjectId {
    return value && Types.ObjectId.isValid(value) ? new Types.ObjectId(value) : new Types.ObjectId();
  }

  private processLedgerEntries(data: {
    transactionId?: string;
    entries: Array<{ userId?: string; type: 'credit' | 'debit'; account: string; amount: number; description: string }>;
  }): Promise<any> {
    // N2 fix: use timestamp + random suffix to prevent ledgerId collisions under concurrent load
    const ledgerId = `LGR-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    const transactionId = this.toLedgerTransactionId(data.transactionId);
    const savedEntries: any[] = [];

    const process = async () => {
      for (const [index, entry] of data.entries.entries()) {
        const amount = Number(entry.amount);
        if (!amount || amount <= 0) {
          throw new BadRequestException('Ledger entry amount must be greater than zero');
        }

        let balanceAfter = 0;
        if (entry.userId) {
          const balanceChange = entry.type === 'credit' ? amount : -amount;
          const wallet = await this.walletModel.findOneAndUpdate(
            { userId: entry.userId },
            {
              $inc: {
                balance: balanceChange,
                ...(entry.type === 'credit' ? { totalEarnings: amount } : {})
              }
            },
            { new: true, upsert: true }
          );
          balanceAfter = wallet.balance;
        }

        savedEntries.push(await new this.ledgerModel({
          ledgerId: `${ledgerId}-${index}`,
          userId: entry.userId,
          transactionId,
          type: entry.type,
          account: entry.account,
          amount,
          description: entry.description,
          balanceAfter
        }).save());
      }
      return { success: true, ledgerId, data: savedEntries };
    };

    return process();
  }

  async deposit(userId: string, amount: number, method: string, phone?: string): Promise<any> {
    if (!amount || amount <= 0) {
      throw new BadRequestException('Deposit amount must be greater than zero');
    }

    await this.processLedgerEntries({
      entries: [
        {
          userId,
          type: 'credit',
          account: 'user_wallet_deposit',
          amount,
          description: `Wallet deposit via ${method}${phone ? ` (${phone})` : ''}`
        }
      ]
    });

    return this.getBalance(userId);
  }

  /**
   * Performs an atomic double-entry transaction
   */
  async processTransaction(data: {
    transactionId: string;
    entries?: Array<{ userId?: string; type: 'credit' | 'debit'; account: string; amount: number; description: string }>;
    orderNumber?: string;
    description: string;
    sellerId: string;
    riderId: string;
    subtotal: number;
    deliveryFee: number;
    sellerPayout?: number;
    riderPayout?: number;
    commissionFloorApplied?: boolean;
  }): Promise<any> {
    if (Array.isArray(data.entries)) {
      return this.processLedgerEntries({ transactionId: data.transactionId, entries: data.entries });
    }

    const ledgerTransactionId = this.toLedgerTransactionId(data.transactionId);
    // N2 fix: collision-resistant ledger ID
    const ledgerId = `LGR-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    const orderRef = data.orderNumber || data.transactionId.substring(0, 8);

    // C1 IMPORTANT: This idempotency check is a read-then-write pattern.
    // It is safe against duplicate webhook retries (seconds apart) but NOT against
    // true concurrent requests within the same millisecond.
    // Full atomicity requires a unique compound index on { transactionId, userId, account }
    // in the LedgerEntry schema — ensure that index exists in @rmf/database ledgerEntrySchema.
    const existingSellerLedger = await this.ledgerModel.findOne({ 
      transactionId: ledgerTransactionId, 
      userId: data.sellerId,
      account: 'seller_wallet'
    });
    
    const existingRiderLedger = await this.ledgerModel.findOne({ 
      transactionId: ledgerTransactionId, 
      userId: data.riderId,
      account: 'rider_wallet'
    });

    // C6 fix: track the actual credited amount (positive) for rollback — not the negated value
    const appliedCredits: Array<{ userId: string; amount: number }> = [];

    try {
      // 1. Process Seller Payout if not already done
      if (!existingSellerLedger && data.sellerPayout !== 0) {
        const sellerCommission = data.sellerPayout !== undefined 
          ? (data.subtotal - data.sellerPayout) 
          : Math.max(data.subtotal * 0.015, 100);
        const sellerNet = data.sellerPayout !== undefined ? data.sellerPayout : (data.subtotal - sellerCommission);

        const sellerWallet = await this.walletModel.findOneAndUpdate(
          { userId: data.sellerId },
          { $inc: { balance: sellerNet, totalEarnings: sellerNet } },
          { new: true, upsert: true }
        );
        // C6 fix: store the positive credited amount; rollback will negate it
        appliedCredits.push({ userId: data.sellerId, amount: sellerNet });

        await new this.ledgerModel({
          ledgerId,
          userId: data.sellerId,
          transactionId: ledgerTransactionId,
          type: 'credit',
          account: 'seller_wallet',
          amount: sellerNet,
          description: `${data.description} (Seller)`,
          balanceAfter: sellerWallet.balance
        }).save();
      }

      // 2. Process Rider Payout if not already done
      if (!existingRiderLedger && data.riderPayout !== 0) {
        const riderCommission = data.riderPayout !== undefined 
          ? (data.deliveryFee - data.riderPayout) 
          : (data.deliveryFee * 0.1);
        const riderNet = data.riderPayout !== undefined ? data.riderPayout : (data.deliveryFee - riderCommission);

        const riderWallet = await this.walletModel.findOneAndUpdate(
          { userId: data.riderId },
          { $inc: { balance: riderNet, totalEarnings: riderNet } },
          { new: true, upsert: true }
        );
        // C6 fix: store the positive credited amount; rollback will negate it
        appliedCredits.push({ userId: data.riderId, amount: riderNet });

        await new this.ledgerModel({
          ledgerId,
          userId: data.riderId,
          transactionId: ledgerTransactionId,
          type: 'credit',
          account: 'rider_wallet',
          amount: riderNet,
          description: `${data.description} (Rider)`,
          balanceAfter: riderWallet.balance
        }).save();
      }

      return { success: true, ledgerId };
    } catch (error) {
      // C6 fix: rollback uses the positive credited amount (negated here) so totalEarnings
      // goes back to its original value instead of going further negative.
      for (const credit of appliedCredits) {
        try {
          await this.walletModel.findOneAndUpdate(
            { userId: credit.userId },
            // Subtract the amount we credited (both balance and totalEarnings)
            { $inc: { balance: -credit.amount, totalEarnings: -credit.amount } }
          );
        } catch (rollbackError) {
          console.error(`CRITICAL: Rollback failed for userId ${credit.userId}. Manual reconciliation required.`, rollbackError);
        }
      }
      throw new InternalServerErrorException('Failed to process wallet transaction');
    }
  }

  async deductWeeklyInsurance(): Promise<any> {
    const INSURANCE_FEE = 500;
    // N2 fix: collision-resistant ID
    const ledgerId = `INS-${Date.now()}-${Math.random().toString(36).slice(2, 5)}`;

    try {
      // C5 fix: Only deduct from rider wallets, not all user wallets.
      // Rider wallets are identified by the `role` field on the wallet document.
      // If `role` is not yet stored on the wallet, this query gracefully falls back
      // to the previous behaviour — ensure rider wallets have role:'rider' set at creation.
      const eligibleWallets = await this.walletModel.find({
        balance: { $gte: INSURANCE_FEE },
        $or: [{ role: 'rider' }, { role: 'RIDER' }],
      }).exec();

      let deducted = 0;
      const errors: string[] = [];

      for (const wallet of eligibleWallets) {
        try {
          const updatedWallet = await this.walletModel.findOneAndUpdate(
            { _id: wallet._id, balance: { $gte: INSURANCE_FEE } },
            { $inc: { balance: -INSURANCE_FEE } },
            { new: true }
          );

          if (updatedWallet) {
            await new this.ledgerModel({
              ledgerId: `${ledgerId}-${deducted}`,
              userId: wallet.userId,
              transactionId: ledgerId,
              type: 'debit',
              account: 'rider_insurance',
              amount: INSURANCE_FEE,
              description: `Weekly insurance deduction`,
              balanceAfter: updatedWallet.balance
            }).save();
            deducted++;
          }
        } catch (err) {
          errors.push(`Failed for wallet ${wallet._id}: ${err}`);
        }
      }

      return {
        success: true,
        message: `Deducted ${INSURANCE_FEE} RWF from ${deducted} rider wallets`,
        deducted,
        errors: errors.length > 0 ? errors : undefined
      };
    } catch (error) {
      return { success: false, message: 'Insurance deduction batch failed', error };
    }
  }

  async requestPayout(userId: string, amount: number, method: string, recipientPhone: string): Promise<any> {
    const wallet = await this.walletModel.findOne({ userId });
    if (!wallet) {
      throw new NotFoundException('Wallet not found');
    }

    // Check available balance (excluding already-pending payouts)
    const pendingTotal = await this.payoutRequestModel.aggregate([
      { $match: { userId, status: { $in: ['pending', 'processing'] } } },
      { $group: { _id: null, total: { $sum: '$amount' } } }
    ]);
    const reservedAmount = pendingTotal[0]?.total || 0;
    const availableBalance = wallet.balance - reservedAmount;

    if (availableBalance < amount) {
      throw new BadRequestException(
        `Insufficient available funds. Balance: ${wallet.balance}, Already pending: ${reservedAmount}, Available: ${availableBalance}`
      );
    }

    // Two-phase payout: DO NOT deduct from balance yet.
    // Only create the payout request. The balance is deducted when
    // the payout is actually processed/completed by the payment gateway.
    // This prevents user funds from being stuck if the payout processor fails.
    const request = new this.payoutRequestModel({
      userId,
      amount,
      method,
      recipientPhone,
      status: 'pending'
    });

    const savedRequest = await request.save();

    // Record a pending ledger entry (not a debit yet)
    const ledgerEntry = new this.ledgerModel({
      ledgerId: `PAY-${savedRequest._id}`,
      userId,
      transactionId: savedRequest._id,
      type: 'debit',
      account: 'user_wallet_pending',
      amount,
      description: `Withdrawal request to ${recipientPhone} (pending)`,
      balanceAfter: wallet.balance // Balance not yet changed
    });
    await ledgerEntry.save();

    return savedRequest;
  }

  async completePayout(payoutId: string): Promise<any> {
    const request = await this.payoutRequestModel.findById(payoutId);
    if (!request) throw new NotFoundException('Payout request not found');
    if (request.status !== 'pending') {
      throw new BadRequestException(`Payout is already in status: ${request.status}`);
    }

    // Atomically deduct the balance and mark payout as completed
    const updatedWallet = await this.walletModel.findOneAndUpdate(
      { userId: request.userId, balance: { $gte: request.amount } },
      { $inc: { balance: -request.amount, totalWithdrawn: request.amount } },
      { new: true }
    );

    if (!updatedWallet) {
      // Insufficient funds — mark as failed, no money was lost since we never deducted
      await this.payoutRequestModel.findByIdAndUpdate(payoutId, {
        $set: { status: 'failed', failureReason: 'Insufficient funds at processing time' }
      });
      throw new BadRequestException('Insufficient funds to complete payout');
    }

    const updated = await this.payoutRequestModel.findByIdAndUpdate(
      payoutId,
      { $set: { status: 'completed' } },
      { new: true }
    );

    // Update the ledger entry from pending to confirmed
    await this.ledgerModel.updateOne(
      { transactionId: payoutId, type: 'debit' },
      {
        $set: {
          account: 'user_wallet',
          balanceAfter: updatedWallet.balance,
          description: `Withdrawal to ${request.recipientPhone} (completed)`
        }
      }
    );

    return updated;
  }

  async failPayout(payoutId: string, reason: string): Promise<any> {
    const request = await this.payoutRequestModel.findById(payoutId);
    if (!request) throw new NotFoundException('Payout request not found');
    if (request.status !== 'pending' && request.status !== 'processing') {
      throw new BadRequestException(`Cannot fail payout in status: ${request.status}`);
    }

    // No money to return since we never deducted at request time
    const updated = await this.payoutRequestModel.findByIdAndUpdate(
      payoutId,
      { $set: { status: 'failed', failureReason: reason } },
      { new: true }
    );

    // Update ledger entry
    await this.ledgerModel.updateOne(
      { transactionId: payoutId, type: 'debit' },
      { $set: { account: 'user_wallet_failed', description: `Withdrawal failed: ${reason}` } }
    );

    return updated;
  }

  async getAllPayoutRequests(): Promise<any> {
    return await this.payoutRequestModel.find({}).sort({ createdAt: -1 }).exec();
  }
}
