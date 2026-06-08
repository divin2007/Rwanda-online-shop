import { Injectable, NotFoundException, BadRequestException, ForbiddenException, forwardRef, Inject, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import axios from 'axios';
import { LocationService } from '@rmf/location';
import { DeliveryGateway } from '../delivery/delivery.gateway';

const ERRAND_TRANSITIONS: Record<string, string[]> = {
  open: ['accepted', 'cancelled'],
  accepted: ['in_progress', 'cancelled'],
  in_progress: ['completed', 'cancelled'],
  completed: [],
  cancelled: [],
};

/**
 * Rider Errands (Feature 4): ad-hoc pickup/drop tasks hired by buyers. On completion the
 * rider wallet is credited (referenceType='errand').
 */
@Injectable()
export class ErrandService {
  private readonly logger = new Logger(ErrandService.name);
  private locationService = new LocationService();

  constructor(
    @InjectModel('Errand') private errandModel: Model<any>,
    @InjectModel('RiderProfile') private riderModel: Model<any>,
    @Inject(forwardRef(() => DeliveryGateway)) private gateway: DeliveryGateway,
  ) {}

  // Phase 3: distance-based fee, consistent with product delivery: ceil(km/5) * DELIVERY_FEE_PER_5KM.
  private readonly DELIVERY_FEE_PER_5KM = Number(process.env.DELIVERY_FEE_PER_5KM) > 0
    ? Number(process.env.DELIVERY_FEE_PER_5KM)
    : 500;
  // Platform takes 10% of the errand fee; rider keeps 90%.
  private readonly PLATFORM_COMMISSION_RATE = 0.1;

  private estimateFee(pickup: any, drop: any): number {
    try {
      const km = this.locationService.calculateDistance(
        { lat: pickup.coordinates.lat, lng: pickup.coordinates.lng },
        { lat: drop.coordinates.lat, lng: drop.coordinates.lng },
      );
      return Math.max(1, Math.ceil(km / 5)) * this.DELIVERY_FEE_PER_5KM;
    } catch {
      return this.DELIVERY_FEE_PER_5KM;
    }
  }

  async create(buyerId: string, body: any): Promise<any> {
    if (!body?.pickupLocation?.coordinates || !body?.dropLocation?.coordinates) {
      throw new BadRequestException('Pickup and drop coordinates are required');
    }
    if (!body?.description) throw new BadRequestException('Description is required');

    const errandType = body.errandType === 'person_pickup' ? 'person_pickup' : 'goods_pickup';
    const paymentMethod = body.paymentMethod === 'external' ? 'external' : 'platform';

    // Server-computed distance-based fee. The buyer's `budget` is informational only; the
    // platform fee is never trusted from the client.
    const agreedFee = this.estimateFee(body.pickupLocation, body.dropLocation);
    const riderEarnings = Math.round(agreedFee * (1 - this.PLATFORM_COMMISSION_RATE));
    const budget = Number(body.budget) > 0 ? Math.round(Number(body.budget)) : agreedFee;

    const errand = await this.errandModel.create({
      buyerId,
      description: String(body.description).slice(0, 1000),
      pickupLocation: body.pickupLocation,
      dropLocation: body.dropLocation,
      budget,
      agreedFee,
      riderEarnings,
      errandType,
      paymentMethod,
      // External payment skips MoMo collection; platform payment starts pending.
      payment: { status: paymentMethod === 'external' ? 'external' : 'pending' },
      status: 'open',
      dispatch: { notifiedRiderIds: [], lastBroadcastAt: new Date() },
    });

    // Person-pickup is restricted to active premium riders.
    if (errandType === 'person_pickup') {
      const premiumRiders = await this.riderModel
        .find({ plan: 'premium', isActive: true, isApproved: true, deletedAt: null })
        .select('userId premiumUntil')
        .lean()
        .exec();
      const now = new Date();
      const allowed = premiumRiders
        .filter((r: any) => !r.premiumUntil || new Date(r.premiumUntil) > now)
        .map((r: any) => String(r.userId));
      this.gateway.broadcastErrand(errand.toObject(), allowed);
    } else {
      this.gateway.broadcastErrand(errand.toObject());
    }

    return { ...errand.toObject(), estimatedFee: agreedFee };
  }

  private isActivePremium(rider: any): boolean {
    return !!rider
      && rider.plan === 'premium'
      && (!rider.premiumUntil || new Date(rider.premiumUntil) > new Date());
  }

  async listOpenForRider(riderUserId: string): Promise<any[]> {
    // Open errands; proximity filtering uses the rider's last known location when present.
    const rider = await this.riderModel.findOne({ userId: riderUserId }).select('currentLocation lastKnownLocation plan premiumUntil').lean().exec();
    const isPremium = this.isActivePremium(rider);
    // Non-premium riders never see person-pickup errands.
    const statusFilter: any = { status: 'open', deletedAt: null };
    if (!isPremium) statusFilter.errandType = { $ne: 'person_pickup' };
    const open = await this.errandModel.find(statusFilter).sort({ createdAt: -1 }).limit(50).lean().exec();

    const loc = (rider as any)?.currentLocation?.coordinates || (rider as any)?.lastKnownLocation;
    if (!loc || !Number.isFinite(loc.lat ?? loc[1])) return open;

    const riderCoords = { lat: loc.lat ?? loc[1], lng: loc.lng ?? loc[0] };
    return open.filter((e: any) => {
      try {
        const km = this.locationService.calculateDistance(riderCoords, {
          lat: e.pickupLocation.coordinates.lat,
          lng: e.pickupLocation.coordinates.lng,
        });
        return km <= 5;
      } catch {
        return true;
      }
    });
  }

  async accept(errandId: string, riderUserId: string): Promise<any> {
    const rider = await this.riderModel.findOne({ userId: riderUserId }).select('_id plan premiumUntil').lean().exec();
    if (!rider) throw new NotFoundException('Rider profile not found');

    // Person-pickup errands may only be accepted by active premium riders (server-side gate;
    // the socket broadcast filter is not authoritative).
    const target = await this.errandModel.findById(errandId).select('errandType status').lean().exec();
    if (!target) throw new NotFoundException('Errand not found');
    if ((target as any).errandType === 'person_pickup' && !this.isActivePremium(rider)) {
      throw new ForbiddenException('Person-pickup errands require an active premium rider plan');
    }

    // Atomic accept: only succeed if still open.
    const errand = await this.errandModel.findOneAndUpdate(
      { _id: errandId, status: 'open' },
      { $set: { status: 'accepted', riderId: rider._id, riderUserId } },
      { new: true },
    );
    if (!errand) throw new BadRequestException('Errand is no longer available');

    this.gateway.emitErrandAccepted(String(errand.buyerId), errand.toObject());
    this.notify(String(errand.buyerId), 'errand.accepted', { errandId: String(errand._id) });
    return errand;
  }

  async updateStatus(errandId: string, riderUserId: string, status: string): Promise<any> {
    const errand = await this.errandModel.findById(errandId);
    if (!errand) throw new NotFoundException('Errand not found');
    if (String(errand.riderUserId || '') !== String(riderUserId)) {
      throw new ForbiddenException('Only the assigned rider can update this errand');
    }
    const allowed = ERRAND_TRANSITIONS[errand.status] || [];
    if (!allowed.includes(status)) {
      throw new BadRequestException(`Invalid errand transition: ${errand.status} -> ${status}`);
    }

    errand.status = status;
    if (status === 'completed') {
      errand.completedAt = new Date();
      await errand.save();
      await this.creditRider(errand);
      this.gateway.emitErrandCompleted(String(errand._id), String(errand.buyerId), errand.toObject());
      this.notify(String(errand.buyerId), 'errand.completed', { errandId: String(errand._id) });
    } else {
      await errand.save();
    }
    return errand;
  }

  async appendTracking(errandId: string, riderUserId: string, lat: number, lng: number): Promise<any> {
    const errand = await this.errandModel.findById(errandId).select('riderUserId').lean().exec();
    if (!errand) throw new NotFoundException('Errand not found');
    if (String(errand.riderUserId || '') !== String(riderUserId)) {
      throw new ForbiddenException('Only the assigned rider can stream location');
    }
    await this.errandModel.findByIdAndUpdate(errandId, {
      $push: { tracking: { lat, lng, recordedAt: new Date() } },
    });
    this.gateway.emitErrandLocation(errandId, { lat, lng });
    return { success: true };
  }

  async myErrands(buyerId: string, page = 1, limit = 20): Promise<any> {
    const skip = (Math.max(1, page) - 1) * limit;
    const [items, total] = await Promise.all([
      this.errandModel.find({ buyerId, deletedAt: null }).sort({ createdAt: -1 }).skip(skip).limit(limit).lean().exec(),
      this.errandModel.countDocuments({ buyerId, deletedAt: null }),
    ]);
    return { items, total, page, limit };
  }

  async getById(errandId: string, userId: string, role: string): Promise<any> {
    const errand = await this.errandModel.findById(errandId).lean().exec();
    if (!errand) throw new NotFoundException('Errand not found');
    const isAdmin = String(role).toUpperCase() === 'ADMIN';
    const isBuyer = String(errand.buyerId) === String(userId);
    const isRider = String(errand.riderUserId || '') === String(userId);
    if (!isAdmin && !isBuyer && !isRider) {
      throw new ForbiddenException('You cannot view this errand');
    }
    return errand;
  }

  private async creditRider(errand: any): Promise<void> {
    // External-payment errands are settled in cash directly to the rider — no wallet credit.
    if (errand.paymentMethod === 'external') return;
    // Credit the rider's 90% share (platform keeps 10%). Fall back to agreedFee*0.9 for legacy rows.
    const amount = Number(errand.riderEarnings || 0) > 0
      ? Number(errand.riderEarnings)
      : Math.round(Number(errand.agreedFee || 0) * 0.9);
    if (amount <= 0 || !errand.riderUserId) return;
    try {
      const walletServiceUrl = process.env.WALLET_SERVICE_URL || 'http://localhost:3007/api/v1';
      const secret = process.env.INTERNAL_SERVICE_SECRET;
      const headers = secret ? { 'x-internal-service-key': secret } : {};
      await axios.post(
        `${walletServiceUrl}/wallets/internal/credit`,
        {
          userId: String(errand.riderUserId),
          role: 'RIDER',
          amount,
          // referenceId is the errand id; the wallet ledger requires an ObjectId-castable id.
          orderId: String(errand._id),
          orderNumber: `ERRAND-${String(errand._id).slice(-6)}`,
          description: `Errand payout for ${String(errand._id).slice(-6)}`,
          referenceType: 'errand',
          account: 'errand_payout',
        },
        { headers },
      );
    } catch (err: any) {
      this.logger.error(`Errand rider credit failed: ${err?.message}`);
    }
  }

  private notify(userId: string, type: string, params: any): void {
    const url = `${process.env.NOTIFICATION_SERVICE_URL || 'http://localhost:3009/api/v1'}/notifications/dispatch`;
    const secret = process.env.INTERNAL_SERVICE_SECRET;
    const headers = secret ? { 'x-internal-service-key': secret } : {};
    axios.post(url, { userId, type, params, channels: ['IN_APP'] }, { headers }).catch(() => {});
  }
}
