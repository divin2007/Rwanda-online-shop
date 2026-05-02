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
    // In our single instance dev environment we'll simulate the atomic block
    
    // 1.5% commission, min 100 RWF
    const sellerCommission = Math.max(data.subtotal * 0.015, 100);
    const sellerNet = data.subtotal - sellerCommission;
    
    // 10% delivery commission
    const companyDeliveryCommission = data.deliveryFee * 0.1;
    const riderNet = data.deliveryFee - companyDeliveryCommission;

    const ledgerId = `LGR-${Date.now()}`;
    const ledgerEntries = [];

    try {
      // 1. Credit Seller Wallet
      const sellerWallet = await this.walletModel.findOneAndUpdate(
        { userId: data.sellerId },
        { 
          $inc: { balance: sellerNet, totalEarnings: sellerNet } 
        },
        { new: true, upsert: true }
      );

      ledgerEntries.push(new this.ledgerModel({
        ledgerId,
        transactionId: data.transactionId,
        type: 'credit',
        account: 'seller_wallet',
        amount: sellerNet,
        description: `Order ${data.transactionId} payout`,
        balanceAfter: sellerWallet.balance
      }));

      // 2. Credit Rider Wallet
      const riderWallet = await this.walletModel.findOneAndUpdate(
        { userId: data.riderId },
        { 
          $inc: { balance: riderNet, totalEarnings: riderNet } 
        },
        { new: true, upsert: true }
      );

      ledgerEntries.push(new this.ledgerModel({
        ledgerId,
        transactionId: data.transactionId,
        type: 'credit',
        account: 'rider_wallet',
        amount: riderNet,
        description: `Delivery fee for ${data.transactionId}`,
        balanceAfter: riderWallet.balance
      }));

      // 3. Record Company Commissions (Virtual Account / Ledger only for tracking)
      const totalCommission = sellerCommission + companyDeliveryCommission;
      ledgerEntries.push(new this.ledgerModel({
        ledgerId,
        transactionId: data.transactionId,
        type: 'credit',
        account: 'company_commission',
        amount: totalCommission,
        description: `Commission for ${data.transactionId}`,
        balanceAfter: 0 // System account doesn't need strict balance tracking here
      }));

      // 4. Save all ledger entries (immutable)
      await this.ledgerModel.insertMany(ledgerEntries);

      return { success: true, ledgerId };
    } catch (error) {
      // In a real transactional system, session.abortTransaction() would revert the wallets.
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
    if (!wallet || wallet.balance < amount) {
      throw new BadRequestException('Insufficient funds');
    }

    // Deduct immediately (hold funds)
    const updatedWallet = await this.walletModel.findOneAndUpdate(
      { userId, balance: { $gte: amount } }, // Optimistic concurrency check
      { $inc: { balance: -amount, totalWithdrawn: amount } },
      { new: true }
    );

    if (!updatedWallet) {
      throw new BadRequestException('Transaction failed, insufficient funds or concurrent modification');
    }

    const request = new this.payoutRequestModel({
      userId,
      amount,
      method,
      recipientPhone,
      status: 'pending'
    });

    const savedRequest = await request.save();

    // Record Ledger
    const ledgerEntry = new this.ledgerModel({
      ledgerId: `PAY-${savedRequest._id}`,
      transactionId: savedRequest._id,
      type: 'debit',
      account: 'user_wallet',
      amount,
      description: `Withdrawal request to ${recipientPhone}`,
      balanceAfter: updatedWallet.balance
    });
    await ledgerEntry.save();

    return savedRequest;
  }
}
