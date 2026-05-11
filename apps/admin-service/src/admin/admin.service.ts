import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import * as mongoose from 'mongoose';
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
      'security.reviewedBy': { $exists: false },
      status: { $nin: ['delivered', 'cancelled', 'resolved'] }
    })
    .sort({ createdAt: -1 })
    .exec();
  }

  async getAccountingSummary(startDate?: string, endDate?: string): Promise<any> {
    const match: any = {};
    if (startDate || endDate) {
      match.createdAt = {};
      if (startDate) match.createdAt.$gte = new Date(startDate);
      if (endDate) match.createdAt.$lte = new Date(endDate);
    }

    const stats = await this.orderModel.aggregate([
      { $match: match },
      {
        $group: {
          _id: null,
          totalGMV: { $sum: '$financials.totalAmount' },
          totalCommission: { $sum: '$financials.platformCommission' },
          totalGateway: { $sum: '$financials.gatewayFee' },
          totalSellerPayout: { $sum: '$financials.sellerPayout' },
          totalRiderPayout: { $sum: '$financials.riderPayout' },
          orderCount: { $sum: 1 },
          deliveredCount: {
            $sum: { $cond: [{ $in: ['$status', ['delivered', 'resolved']] }, 1, 0] }
          }
        }
      }
    ]);

    return stats[0] || {
      totalGMV: 0, totalCommission: 0, totalGateway: 0,
      totalSellerPayout: 0, totalRiderPayout: 0,
      orderCount: 0, deliveredCount: 0
    };
  }

  async getAccountingBySeller(startDate?: string, endDate?: string): Promise<any> {
    const match: any = {};
    if (startDate || endDate) {
      match.createdAt = {};
      if (startDate) match.createdAt.$gte = new Date(startDate);
      if (endDate) match.createdAt.$lte = new Date(endDate);
    }

    return this.orderModel.aggregate([
      { $match: match },
      {
        $group: {
          _id: { sellerId: '$seller.sellerId', name: '$seller.fullName' },
          orderCount: { $sum: 1 },
          totalGMV: { $sum: '$financials.totalAmount' },
          totalCommission: { $sum: '$financials.platformCommission' },
          totalSellerPayout: { $sum: '$financials.sellerPayout' },
        }
      },
      {
        $project: {
          _id: 0,
          sellerId: '$_id.sellerId',
          sellerName: '$_id.name',
          orderCount: 1,
          totalGMV: 1,
          totalCommission: 1,
          totalSellerPayout: 1,
        }
      },
      { $sort: { totalGMV: -1 } }
    ]);
  }

  async getSellerAnalytics(sellerId: string): Promise<any> {
    const stats = await this.orderModel.aggregate([
      { $match: { 'seller.userId': new mongoose.Types.ObjectId(sellerId), deletedAt: null } },
      {
        $group: {
          _id: null,
          totalSales: { $sum: '$financials.totalAmount' },
          totalOrders: { $sum: 1 },
          completedOrders: {
            $sum: { $cond: [{ $in: ['$status', ['delivered', 'resolved']] }, 1, 0] }
          }
        }
      }
    ]);

    // Calculate real avg prep time from statusHistory
    const prepStats = await this.orderModel.aggregate([
      { 
        $match: { 
          'seller.userId': new mongoose.Types.ObjectId(sellerId),
          'statusHistory.status': { $all: ['confirmed', 'ready_for_pickup'] }
        } 
      },
      {
        $project: {
          confirmedAt: {
            $filter: { input: "$statusHistory", as: "h", cond: { $eq: ["$$h.status", "confirmed"] } }
          },
          readyAt: {
            $filter: { input: "$statusHistory", as: "h", cond: { $eq: ["$$h.status", "ready_for_pickup"] } }
          }
        }
      },
      {
        $project: {
          prepTimeMs: {
            $subtract: [
              { $arrayElemAt: ["$readyAt.changedAt", 0] },
              { $arrayElemAt: ["$confirmedAt.changedAt", 0] }
            ]
          }
        }
      },
      {
        $group: {
          _id: null,
          avgPrepTimeMs: { $avg: "$prepTimeMs" }
        }
      }
    ]);

    const avgPrepTimeMin = prepStats[0]?.avgPrepTimeMs 
      ? Math.round(prepStats[0].avgPrepTimeMs / 60000) 
      : 15; // Fallback to 15 if no data

    return {
      salesToday: stats[0]?.totalSales || 0,
      totalOrders: stats[0]?.totalOrders || 0,
      completedOrders: stats[0]?.completedOrders || 0,
      avgPrepTime: avgPrepTimeMin,
    };
  }

  async getAnalyticsDashboard(sellerId?: string): Promise<any> {
    const match: any = { deletedAt: null };
    if (sellerId) {
      match['seller.userId'] = new mongoose.Types.ObjectId(sellerId);
    }

    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    // Run aggregations in parallel for better performance
    const [trends, statusDistribution, performanceData] = await Promise.all([
      // 1. Revenue Trends (Last 30 days)
      this.orderModel.aggregate([
        { $match: { ...match, createdAt: { $gte: thirtyDaysAgo } } },
        {
          $group: {
            _id: { $dateToString: { format: "%Y-%m-%d", date: "$createdAt" } },
            revenue: { $sum: "$financials.totalAmount" },
            count: { $sum: 1 }
          }
        },
        { $sort: { "_id": 1 } }
      ]),

      // 2. Status Distribution
      this.orderModel.aggregate([
        { $match: match },
        {
          $group: {
            _id: "$status",
            count: { $sum: 1 }
          }
        }
      ]),

      // 3. Performance (Top Sellers or Top Products)
      !sellerId ? 
        this.orderModel.aggregate([
          { $match: match },
          {
            $group: {
              _id: "$seller.fullName",
              revenue: { $sum: "$financials.totalAmount" }
            }
          },
          { $sort: { revenue: -1 } },
          { $limit: 5 },
          { $project: { name: "$_id", revenue: 1, _id: 0 } }
        ]) :
        this.orderModel.aggregate([
          { $match: match },
          { $unwind: "$products" },
          {
            $group: {
              _id: "$products.name",
              sales: { $sum: "$products.quantity" }
            }
          },
          { $sort: { sales: -1 } },
          { $limit: 5 },
          { $project: { name: "$_id", sales: 1, _id: 0 } }
        ])
    ]);

    return {
      trends: trends.map(t => ({ date: t._id, revenue: t.revenue, count: t.count })),
      statusDistribution: statusDistribution.map(s => ({ name: s._id, value: s.count })),
      performance: performanceData
    };
  }
}
