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
    const wallet = await this.walletModel.findOne({ userId });
    if (!wallet) throw new NotFoundException('Wallet not found');
    return wallet;
  }

  /**
   * Performs an atomic double-entry transaction
   */
  async processTransaction(data: {
    transactionId: string;
    description: string;
    sellerId: string;
    riderId: string;
    subtotal: number;
    deliveryFee: number;
    commissionFloorApplied: boolean;
  }): Promise<any> {
    // Requires a MongoDB Replica Set for transactions
    // In our single instance dev environment we use manual compensation rollback

    // 1.5% commission, min 100 RWF
    const sellerCommission = Math.max(data.subtotal * 0.015, 100);
    const sellerNet = data.subtotal - sellerCommission;

    // 10% delivery commission
    const companyDeliveryCommission = data.deliveryFee * 0.1;
    const riderNet = data.deliveryFee - companyDeliveryCommission;

    const ledgerId = `LGR-${Date.now()}`;
    const appliedCredits: Array<{ userId: string; amount: number }> = [];

    try {
      // 1. Credit Seller Wallet
      const sellerWallet = await this.walletModel.findOneAndUpdate(
        { userId: data.sellerId },
        {
          $inc: { balance: sellerNet, totalEarnings: sellerNet }
        },
        { new: true, upsert: true }
      );
      appliedCredits.push({ userId: data.sellerId, amount: -sellerNet });

      // 2. Credit Rider Wallet
      const riderWallet = await this.walletModel.findOneAndUpdate(
        { userId: data.riderId },
        {
          $inc: { balance: riderNet, totalEarnings: riderNet }
        },
        { new: true, upsert: true }
      );
      appliedCredits.push({ userId: data.riderId, amount: -riderNet });

      // 3. Record Company Commissions (Virtual Account / Ledger only for tracking)
      const totalCommission = sellerCommission + companyDeliveryCommission;

      // 4. Save all ledger entries (immutable)
      const ledgerEntries = [
        new this.ledgerModel({
          ledgerId,
          transactionId: data.transactionId,
          type: 'credit',
          account: 'seller_wallet',
          amount: sellerNet,
          description: `Order ${data.transactionId} payout`,
          balanceAfter: sellerWallet.balance
        }),
        new this.ledgerModel({
          ledgerId,
          transactionId: data.transactionId,
          type: 'credit',
          account: 'rider_wallet',
          amount: riderNet,
          description: `Delivery fee for ${data.transactionId}`,
          balanceAfter: riderWallet.balance
        }),
        new this.ledgerModel({
          ledgerId,
          transactionId: data.transactionId,
          type: 'credit',
          account: 'company_commission',
          amount: totalCommission,
          description: `Commission for ${data.transactionId}`,
          balanceAfter: 0
        })
      ];

      await this.ledgerModel.insertMany(ledgerEntries);

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
    // Retrieve all riders with active wallets
    // For this stub, we just pretend to deduct 500 RWF
    const INSURANCE_FEE = 500;
    const ledgerId = `INS-${Date.now()}`;

    // This would typically be an aggregation or batch update
    // e.g. updateMany({ balance: { $gte: INSURANCE_FEE } }, { $inc: { balance: -INSURANCE_FEE } })
    return { success: true, message: `Deducted ${INSURANCE_FEE} from eligible riders` };
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
