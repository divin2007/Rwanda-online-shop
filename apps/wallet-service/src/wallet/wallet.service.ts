import { GoneException, Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';

@Injectable()
export class WalletService {
  private readonly disabledMessage =
    'RMF wallets are disabled for compliance. Real money movement must be processed through Paypack; RMF only keeps accounting ledger records.';

  constructor(
    @InjectModel('Wallet') private walletModel: Model<any>,
    @InjectModel('LedgerEntry') private ledgerModel: Model<any>,
    @InjectModel('PayoutRequest') private payoutRequestModel: Model<any>
  ) {}

  async createWallet(_userId: string): Promise<any> {
    throw new GoneException(this.disabledMessage);
  }

  async getBalance(userId: string): Promise<any> {
    const legacyWallet = await this.walletModel.findOne({ userId }).lean().exec();
    return {
      userId,
      balance: 0,
      pendingBalance: 0,
      totalEarnings: 0,
      totalWithdrawn: 0,
      disabled: true,
      message: this.disabledMessage,
      legacyWalletId: legacyWallet?._id,
      legacyBalanceHidden: legacyWallet ? Number(legacyWallet.balance || 0) : 0,
    };
  }

  async getTransactions(userId: string): Promise<any> {
    return this.ledgerModel.find({ userId }).sort({ createdAt: -1 }).limit(50).exec();
  }

  async deposit(_userId: string, _amount: number, _method: string, _phone?: string): Promise<any> {
    throw new GoneException(this.disabledMessage);
  }

  async processTransaction(_data: any): Promise<any> {
    throw new GoneException(this.disabledMessage);
  }

  async deductWeeklyInsurance(): Promise<any> {
    throw new GoneException(this.disabledMessage);
  }

  async requestPayout(_userId: string, _amount: number, _method: string, _recipientPhone: string): Promise<any> {
    throw new GoneException(this.disabledMessage);
  }

  async completePayout(_payoutId: string): Promise<any> {
    throw new GoneException(this.disabledMessage);
  }

  async failPayout(_payoutId: string, _reason: string): Promise<any> {
    throw new GoneException(this.disabledMessage);
  }

  async getAllPayoutRequests(): Promise<any> {
    return this.payoutRequestModel.find({}).sort({ createdAt: -1 }).exec();
  }
}
