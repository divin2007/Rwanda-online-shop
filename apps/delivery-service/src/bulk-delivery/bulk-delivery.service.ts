import { Injectable, NotFoundException, BadRequestException, ForbiddenException, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import axios from 'axios';

/**
 * Same-Day Bulk Delivery (Feature 5): one pickup, many drop points, for a verified B2B account.
 */
@Injectable()
export class BulkDeliveryService {
  private readonly logger = new Logger(BulkDeliveryService.name);

  constructor(
    @InjectModel('BulkDeliveryRequest') private bulkModel: Model<any>,
    @InjectModel('B2BAccount') private b2bModel: Model<any>,
    @InjectModel('RiderProfile') private riderModel: Model<any>,
  ) {}

  private async getVerifiedAccount(userId: string): Promise<any> {
    const account = await this.b2bModel.findOne({ userId, deletedAt: null }).lean().exec();
    if (!account) throw new ForbiddenException('A B2B account is required for bulk delivery');
    if (!account.isVerified) throw new ForbiddenException('Your B2B account must be verified first');
    return account;
  }

  async create(userId: string, body: any): Promise<any> {
    const account = await this.getVerifiedAccount(userId);
    const dropoffs = Array.isArray(body.dropoffPoints) ? body.dropoffPoints : [];
    if (dropoffs.length === 0) throw new BadRequestException('At least one dropoff point is required');

    const perDropFee = 500;
    const distanceFee = Number(body.distanceFee) > 0 ? Math.round(Number(body.distanceFee)) : 0;
    const totalFee = 1000 + dropoffs.length * perDropFee + distanceFee;

    return this.bulkModel.create({
      b2bAccountId: account._id,
      buyerUserId: userId,
      marketId: body.marketId,
      items: Array.isArray(body.items) ? body.items : [],
      scheduledPickupWindow: body.scheduledPickupWindow || {},
      dropoffPoints: dropoffs.map((d: any) => ({
        address: d.address,
        coordinates: d.coordinates,
        contactName: d.contactName,
        contactPhone: d.contactPhone,
        status: 'pending',
      })),
      perDropFee,
      totalFee,
      status: 'scheduled',
      notes: body.notes,
    });
  }

  async mine(userId: string, page = 1, limit = 20): Promise<any> {
    const skip = (Math.max(1, page) - 1) * limit;
    const [items, total] = await Promise.all([
      this.bulkModel.find({ buyerUserId: userId, deletedAt: null }).sort({ createdAt: -1 }).skip(skip).limit(limit).lean().exec(),
      this.bulkModel.countDocuments({ buyerUserId: userId, deletedAt: null }),
    ]);
    return { items, total, page, limit };
  }

  async getById(id: string, userId: string, role: string): Promise<any> {
    const req = await this.bulkModel.findById(id).lean().exec();
    if (!req) throw new NotFoundException('Bulk delivery not found');
    const isAdmin = String(role).toUpperCase() === 'ADMIN';
    const isOwner = String(req.buyerUserId) === String(userId);
    const isRider = String(req.riderUserId || '') === String(userId);
    if (!isAdmin && !isOwner && !isRider) throw new ForbiddenException('You cannot view this bulk delivery');
    return req;
  }

  async assignRider(id: string, riderUserId?: string): Promise<any> {
    // Admin/internal assigns the nearest available rider. Falls back to any active rider.
    let rider: any = null;
    if (riderUserId) {
      rider = await this.riderModel.findOne({ userId: riderUserId }).select('_id userId').lean().exec();
    }
    if (!rider) {
      rider = await this.riderModel.findOne({ isActive: true, deletedAt: null }).select('_id userId').lean().exec();
    }
    if (!rider) throw new NotFoundException('No available rider found');

    const updated = await this.bulkModel.findOneAndUpdate(
      { _id: id, status: 'scheduled' },
      { $set: { riderId: rider._id, riderUserId: rider.userId, status: 'assigned' } },
      { new: true },
    );
    if (!updated) throw new BadRequestException('Bulk delivery cannot be assigned at its current status');
    return updated;
  }

  async confirmDropoff(id: string, index: number, riderUserId: string): Promise<any> {
    const req = await this.bulkModel.findById(id);
    if (!req) throw new NotFoundException('Bulk delivery not found');
    if (String(req.riderUserId || '') !== String(riderUserId)) {
      throw new ForbiddenException('Only the assigned rider can confirm dropoffs');
    }
    if (!req.dropoffPoints[index]) throw new BadRequestException('Invalid dropoff index');

    req.dropoffPoints[index].status = 'delivered';
    req.dropoffPoints[index].deliveredAt = new Date();
    if (req.status === 'assigned') req.status = 'in_progress';

    const allDelivered = req.dropoffPoints.every((d: any) => d.status === 'delivered');
    if (allDelivered) {
      req.status = 'completed';
      await req.save();
      await this.creditRider(req);
    } else {
      await req.save();
    }
    return req;
  }

  private async creditRider(req: any): Promise<void> {
    const amount = Number(req.totalFee || 0);
    if (amount <= 0 || !req.riderUserId) return;
    try {
      const walletServiceUrl = process.env.WALLET_SERVICE_URL || 'http://localhost:3007/api/v1';
      const secret = process.env.INTERNAL_SERVICE_SECRET;
      const headers = secret ? { 'x-internal-service-key': secret } : {};
      await axios.post(
        `${walletServiceUrl}/wallets/internal/credit`,
        {
          userId: String(req.riderUserId),
          role: 'RIDER',
          amount,
          orderId: String(req._id),
          orderNumber: `BULK-${String(req._id).slice(-6)}`,
          description: `Bulk delivery payout for ${String(req._id).slice(-6)}`,
          referenceType: 'bulk_delivery',
          account: 'bulk_delivery_payout',
        },
        { headers },
      );
    } catch (err: any) {
      this.logger.error(`Bulk delivery rider credit failed: ${err?.message}`);
    }
  }
}
