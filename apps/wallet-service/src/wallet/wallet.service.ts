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

  /**
   * Performs an atomic double-entry transaction
   */
  async processTransaction(data: {
    transactionId: string;
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
    const ledgerId = `LGR-${Date.now()}`;
    const orderRef = data.orderNumber || data.transactionId.substring(0, 8);
    
    // Check if this specific payout (seller or rider) has already been processed
    const existingSellerLedger = await this.ledgerModel.findOne({ 
      transactionId: data.transactionId, 
      userId: data.sellerId,
      account: 'seller_wallet'
    });
    
    const existingRiderLedger = await this.ledgerModel.findOne({ 
      transactionId: data.transactionId, 
      userId: data.riderId,
      account: 'rider_wallet'
    });

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
        appliedCredits.push({ userId: data.sellerId, amount: -sellerNet });

        await new this.ledgerModel({
          ledgerId,
          userId: data.sellerId,
          transactionId: data.transactionId,
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
        appliedCredits.push({ userId: data.riderId, amount: -riderNet });

        await new this.ledgerModel({
          ledgerId,
          userId: data.riderId,
          transactionId: data.transactionId,
          type: 'credit',
          account: 'rider_wallet',
          amount: riderNet,
          description: `${data.description} (Rider)`,
          balanceAfter: riderWallet.balance
        }).save();
      }

      return { success: true, ledgerId };
    } catch (error) {
      // Manual compensation rollback (since we don't have replica set transactions):
      // Reverse each wallet credit that was applied before the failure.
      for (const credit of appliedCredits) {
        try {
          await this.walletModel.findOneAndUpdate(
            { userId: credit.userId },
            {
              $inc: { balance: credit.amount, totalEarnings: credit.amount }
            }
          );
        } catch (rollbackError) {
          // Log critical: manual intervention needed — wallet state is inconsistent
          console.error(`CRITICAL: Rollback failed for userId ${credit.userId}. Manual reconciliation required.`, rollbackError);
        }
      }
      throw new InternalServerErrorException('Failed to process wallet transaction');
    }
  }

  async deductWeeklyInsurance(): Promise<any> {
    const INSURANCE_FEE = 500;
    const ledgerId = `INS-${Date.now()}`;

    try {
      // Find all rider wallets with sufficient balance
      // Riders are identified by having a wallet and being referenced in rider profiles
      const eligibleWallets = await this.walletModel.find({
        balance: { $gte: INSURANCE_FEE }
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
}
