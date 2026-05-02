import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';

@Injectable()
export class AdminService {
  constructor(
    @InjectModel('SellerProfile') private sellerModel: Model<any>,
    @InjectModel('Market') private marketModel: Model<any>,
    @InjectModel('Transaction') private orderModel: Model<any>,
    @InjectModel('AuditLog') private auditModel: Model<any>
  ) {}

  async getPendingApprovals(): Promise<any> {
    const pendingSellers = await this.sellerModel.find({ isApproved: false, deletedAt: null }).exec();
    const pendingMarkets = await this.marketModel.find({ isActive: false, deletedAt: null }).exec();
    
    return {
      sellers: pendingSellers,
      markets: pendingMarkets
    };
  }

  async getDisputes(status?: 'active' | 'resolved'): Promise<any> {
    const query: any = { 'dispute.isDisputed': true };
    if (status === 'active') {
      query.status = 'disputed';
    } else if (status === 'resolved') {
      query.status = 'resolved';
    }

    return this.orderModel.find(query).exec();
  }

  async getSystemAnalytics(): Promise<any> {
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

    const revenueStats = await this.orderModel.aggregate([
      { 
        $match: { 
          status: { $in: ['delivered', 'resolved'] }, 
          createdAt: { $gte: startOfMonth } 
        } 
      },
      { 
        $group: { 
          _id: null, 
          totalGMV: { $sum: '$financials.totalAmount' },
          totalCommission: { $sum: '$financials.platformCommission' }
        } 
      }
    ]);

    const activeSellers = await this.sellerModel.countDocuments({ isApproved: true });
    
    return {
      monthlyGMV: revenueStats[0]?.totalGMV || 0,
      monthlyCommission: revenueStats[0]?.totalCommission || 0,
      activeSellers,
      timestamp: now
    };
  }

  async getFraudAlerts(): Promise<any> {
    return this.orderModel.find({ 
      'security.isFlagged': true,
      'security.reviewedBy': { $exists: false }
    })
    .sort({ createdAt: -1 })
    .exec();
  }
}
