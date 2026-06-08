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
    @InjectModel('AuditLog') private auditModel: Model<any>,
    @InjectModel('Delivery') private deliveryModel: Model<any>,
    @InjectModel('Review') private reviewModel: Model<any>,
    @InjectModel('SupportTicket') private supportTicketModel: Model<any>,
    @InjectModel('SellerVideo') private sellerVideoModel: Model<any>,
    @InjectModel('NotificationLog') private notificationLogModel: Model<any>,
    @InjectModel('LedgerEntry') private ledgerModel: Model<any>
  ) {}

  private async resolveSellerProfile(sellerId: string): Promise<any | null> {
    if (!sellerId || !mongoose.Types.ObjectId.isValid(sellerId)) {
      return null;
    }

    const objectId = new mongoose.Types.ObjectId(sellerId);
    return this.sellerModel.findOne({
      deletedAt: null,
      $or: [
        { _id: objectId },
        { userId: objectId },
      ],
    }).lean().exec();
  }

  private sellerOrderMatch(profile: any): any {
    const clauses: any[] = [];
    if (profile?._id) clauses.push({ 'seller.sellerId': profile._id });
    if (profile?.userId) clauses.push({ 'seller.userId': profile.userId });

    return clauses.length > 0
      ? { deletedAt: null, $or: clauses }
      : { deletedAt: null, _id: { $exists: false } };
  }

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

  async getSummaryAnalytics(): Promise<any> {
    const [marketCount, sellerCount, orderCount] = await Promise.all([
      this.marketModel.countDocuments({ isActive: true, deletedAt: null }),
      this.sellerModel.countDocuments({ isApproved: true, deletedAt: null }),
      this.orderModel.countDocuments({ deletedAt: null })
    ]);

    // Calculate trust rating based on successful deliveries vs total orders
    const deliveredCount = await this.orderModel.countDocuments({ status: { $in: ['delivered', 'resolved'] }, deletedAt: null });
    const trustRating = orderCount > 0 ? (deliveredCount / orderCount) * 100 : 99.2;

    return {
      marketCount,
      sellerCount,
      orderCount,
      trustRating: Math.round(trustRating * 10) / 10
    };
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

  async getOperationsOverview(): Promise<any> {
    const now = new Date();
    const threeHoursAgo = new Date(now.getTime() - 3 * 60 * 60 * 1000);
    const sixHoursAgo = new Date(now.getTime() - 6 * 60 * 60 * 1000);

    const [
      activeDisputes,
      refundFailures,
      releasePending,
      settlementFailures,
      assignedWithoutRider,
      stalledDeliveries,
      failedNotifications,
      pendingVideos,
      openSupportTickets,
      recentLedgerFailures,
    ] = await Promise.all([
      this.orderModel.countDocuments({ 'dispute.isDisputed': true, 'dispute.resolvedAt': { $exists: false }, deletedAt: null }),
      this.orderModel.countDocuments({ 'refund.status': 'failed', deletedAt: null }),
      this.orderModel.countDocuments({ 'settlement.status': 'release_pending', deletedAt: null }),
      this.orderModel.countDocuments({ 'settlement.status': 'failed', deletedAt: null }),
      this.deliveryModel.countDocuments({
        status: 'assigned',
        $or: [{ 'rider.riderId': null }, { 'rider.riderId': { $exists: false } }],
        deletedAt: null,
      }),
      this.deliveryModel.countDocuments({
        status: { $in: ['assigned', 'en_route_to_pickup', 'pending_handover', 'picked_up', 'en_route_to_dropoff'] },
        updatedAt: { $lt: threeHoursAgo },
        deletedAt: null,
      }),
      this.notificationLogModel.countDocuments({ status: 'FAILED', createdAt: { $gte: sixHoursAgo } }),
      this.sellerVideoModel.countDocuments({
        moderationStatus: { $in: ['PENDING', 'FLAGGED'] },
        deletedAt: null,
      }),
      this.supportTicketModel.countDocuments({ status: { $nin: ['RESOLVED', 'CLOSED'] } }),
      this.ledgerModel.find({ status: 'failed' }).sort({ createdAt: -1 }).limit(10).lean().exec(),
    ]);

    const liveDispatches = await this.deliveryModel.find({
      status: 'assigned',
      deletedAt: null,
    })
      .select('orderNumber pickup dropoff financials dispatch createdAt updatedAt')
      .sort({ updatedAt: -1 })
      .limit(20)
      .lean()
      .exec();

    const payoutQueue = await this.orderModel.find({
      'settlement.status': { $in: ['release_pending', 'failed', 'partial'] },
      deletedAt: null,
    })
      .select('orderNumber buyer seller financials payment settlement refund dispute status createdAt updatedAt')
      .sort({ updatedAt: -1 })
      .limit(25)
      .lean()
      .exec();

    return {
      generatedAt: now,
      counts: {
        activeDisputes,
        refundFailures,
        releasePending,
        settlementFailures,
        assignedWithoutRider,
        stalledDeliveries,
        failedNotifications,
        pendingVideos,
        openSupportTickets,
      },
      actionQueues: {
        dispatches: liveDispatches,
        payoutAndEscrow: payoutQueue,
        failedLedgerEntries: recentLedgerFailures,
      },
      readiness: {
        paypackCashinConfigured: Boolean(process.env.PAYPACK_CLIENT_ID && process.env.PAYPACK_CLIENT_SECRET),
        paypackWebhookConfigured: Boolean(process.env.PAYPACK_WEBHOOK_SECRET),
        paypackSettlementConfigured: Boolean(process.env.PAYPACK_PLATFORM_PHONE || process.env.RMF_PLATFORM_MOMO_NUMBER || process.env.PLATFORM_MOMO_NUMBER),
        smsConfigured: Boolean(process.env.SMS_WEBHOOK_URL),
        whatsappConfigured: Boolean(process.env.WHATSAPP_WEBHOOK_URL),
        smtpConfigured: Boolean(process.env.SMTP_HOST),
        geocoder: {
          provider: process.env.GEOCODER_PROVIDER || 'auto',
          mapboxConfigured: Boolean(process.env.MAPBOX_ACCESS_TOKEN),
          opencageConfigured: Boolean(process.env.OPENCAGE_API_KEY),
        },
      },
    };
  }

  async getFraudAlerts(): Promise<any> {
    const explicitFlags = await this.orderModel.find({ 
      'security.isFlagged': true,
      'security.reviewedBy': { $exists: false },
      status: { $nin: ['delivered', 'cancelled', 'resolved'] }
    })
    .sort({ createdAt: -1 })
    .limit(50)
    .exec();

    // 1. Detect Rider Stagnation (Incomplete tasks)
    const threeHoursAgo = new Date();
    threeHoursAgo.setHours(threeHoursAgo.getHours() - 3);

    const stagnantRiders = await this.deliveryModel.aggregate([
      { 
        $match: { 
          status: { $in: ['assigned', 'en_route_to_pickup', 'picked_up', 'pending_handover'] },
          updatedAt: { $lt: threeHoursAgo },
          deletedAt: null
        } 
      },
      {
        $group: {
          _id: '$rider.riderId',
          riderName: { $first: '$rider.fullName' },
          incompleteCount: { $sum: 1 },
          orderIds: { $push: '$orderId' },
          lastUpdate: { $min: '$updatedAt' }
        }
      },
      { $match: { incompleteCount: { $gte: 2 } } }, // Many = 2 or more for RMF scale
      { $sort: { incompleteCount: -1 } }
    ]);

    // 2. Detect Seller Stagnation (Ghosting)
    const sixHoursAgo = new Date();
    sixHoursAgo.setHours(sixHoursAgo.getHours() - 6);

    const stagnantSellers = await this.orderModel.aggregate([
      {
        $match: {
          status: { $in: ['confirmed', 'preparing'] },
          updatedAt: { $lt: sixHoursAgo },
          deletedAt: null
        }
      },
      {
        $group: {
          _id: '$seller.sellerId',
          sellerName: { $first: '$seller.fullName' },
          stagnantCount: { $sum: 1 },
          orderNumbers: { $push: '$orderNumber' },
          stallId: { $first: '$seller.stallId' }
        }
      },
      { $match: { stagnantCount: { $gte: 3 } } }, // Many = 3 or more for sellers
      { $sort: { stagnantCount: -1 } }
    ]);

    // Map to a unified "Alert" format
    const behavioralAlerts = [
      ...stagnantRiders.map(r => ({
        _id: `rider-${r._id}`,
        type: 'RIDER_STAGNATION',
        severity: r.incompleteCount > 5 ? 'CRITICAL' : 'HIGH',
        actor: r.riderName,
        actorId: r._id,
        count: r.incompleteCount,
        reason: `Rider has ${r.incompleteCount} accepted tasks stagnant for > 3 hours.`,
        relatedOrders: r.orderIds,
        createdAt: r.lastUpdate
      })),
      ...stagnantSellers.map(s => ({
        _id: `seller-${s._id}`,
        type: 'SELLER_GHOSTING',
        severity: s.stagnantCount > 8 ? 'CRITICAL' : 'HIGH',
        actor: s.sellerName,
        actorId: s._id,
        count: s.stagnantCount,
        reason: `Seller has ${s.stagnantCount} confirmed orders unfulfilled for > 6 hours.`,
        relatedOrders: s.orderNumbers,
        createdAt: new Date()
      }))
    ];

    return [
      ...explicitFlags.map(f => ({
        _id: f._id,
        type: 'SECURITY_FLAG',
        severity: 'MEDIUM',
        actor: f.buyer.fullName,
        reason: f.security.flagReason || 'System flagged transaction anomaly',
        relatedOrders: [f.orderNumber],
        createdAt: f.createdAt
      })),
      ...behavioralAlerts
    ].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
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
    const sellerProfile = await this.resolveSellerProfile(sellerId);
    if (!sellerProfile) {
      throw new NotFoundException('Seller profile not found');
    }

    const match = this.sellerOrderMatch(sellerProfile);

    const stats = await this.orderModel.aggregate([
      { $match: match },
      {
        $group: {
          _id: null,
          totalRevenue: { $sum: '$financials.totalAmount' },
          totalOrders: { $sum: 1 },
          completedOrders: {
            $sum: { $cond: [{ $in: ['$status', ['delivered', 'resolved']] }, 1, 0] }
          },
          cancelledOrders: {
            $sum: { $cond: [{ $eq: ['$status', 'cancelled'] }, 1, 0] }
          }
        }
      }
    ]);

    const [prepStats, buyerStats, ratingStats] = await Promise.all([
      this.orderModel.aggregate([
      {
        $match: {
          ...match,
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
      ]),
      this.orderModel.aggregate([
        { $match: match },
        {
          $group: {
            _id: '$buyer.userId',
            orders: { $sum: 1 }
          }
        },
        {
          $group: {
            _id: null,
            uniqueBuyers: { $sum: 1 },
            repeatBuyers: { $sum: { $cond: [{ $gt: ['$orders', 1] }, 1, 0] } }
          }
        }
      ]),
      this.reviewModel.aggregate([
        {
          $match: {
            targetType: 'seller',
            targetId: sellerProfile._id,
            deletedAt: null
          }
        },
        {
          $group: {
            _id: null,
            avgRating: { $avg: '$rating' },
            totalReviews: { $sum: 1 }
          }
        }
      ])
    ]);

    const avgPrepTimeMin = prepStats[0]?.avgPrepTimeMs 
      ? Math.round(prepStats[0].avgPrepTimeMs / 60000) 
      : null;

    const totalOrders = stats[0]?.totalOrders || 0;
    const completedOrders = stats[0]?.completedOrders || 0;
    const uniqueBuyers = buyerStats[0]?.uniqueBuyers || 0;
    const repeatBuyers = buyerStats[0]?.repeatBuyers || 0;
    const avgRating = ratingStats[0]?.avgRating ?? sellerProfile.rating ?? 0;

    return {
      salesToday: stats[0]?.totalRevenue || 0,
      totalRevenue: stats[0]?.totalRevenue || 0,
      totalOrders,
      completedOrders,
      cancelledOrders: stats[0]?.cancelledOrders || 0,
      fulfillmentRate: totalOrders > 0 ? Math.round((completedOrders / totalOrders) * 100) : 0,
      repeatBuyerRate: uniqueBuyers > 0 ? Math.round((repeatBuyers / uniqueBuyers) * 100) : 0,
      avgRating: Math.round(avgRating * 10) / 10,
      totalReviews: ratingStats[0]?.totalReviews || 0,
      avgPrepTime: avgPrepTimeMin,
    };
  }

  async getAnalyticsDashboard(sellerId?: string): Promise<any> {
    const match: any = { deletedAt: null };
    if (sellerId) {
      const sellerProfile = await this.resolveSellerProfile(sellerId);
      if (!sellerProfile) {
        return { trends: [], statusDistribution: [], performance: [] };
      }
      Object.assign(match, this.sellerOrderMatch(sellerProfile));
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

  async getSupportTickets(): Promise<any> {
    return this.supportTicketModel.find().sort({ createdAt: -1 }).exec();
  }

  async updateSupportTicketStatus(id: string, status: string, resolvedBy?: string): Promise<any> {
    const updatePayload: any = { status };
    if (status === 'RESOLVED' || status === 'CLOSED') {
      updatePayload.resolvedBy = resolvedBy;
      updatePayload.resolvedAt = new Date();
    }
    const ticket = await this.supportTicketModel.findByIdAndUpdate(
      id,
      { $set: updatePayload },
      { new: true }
    ).exec();
    if (!ticket) throw new NotFoundException('Support ticket not found');
    return ticket;
  }
}
