import { Injectable, NotFoundException, BadRequestException, ForbiddenException, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import axios from 'axios';
import { OrderStatus } from '@rmf/shared-types';
import { OrderGateway } from '../order/order.gateway';

/**
 * Group Buying (Feature 1). Buyers join a campaign; once targetQty is reached the seller's
 * group buy locks, materializing a discounted Transaction per participant and a multi-stop
 * Delivery.
 *
 * SECURITY: participant addresses are NEVER exposed to other participants. Public detail
 * responses return only a count and anonymized participant list.
 */
@Injectable()
export class GroupBuyService {
  private readonly logger = new Logger(GroupBuyService.name);

  constructor(
    @InjectModel('GroupBuy') private groupBuyModel: Model<any>,
    @InjectModel('Transaction') private orderModel: Model<any>,
    @InjectModel('Product') private productModel: Model<any>,
    @InjectModel('SellerProfile') private sellerModel: Model<any>,
    @InjectModel('User') private userModel: Model<any>,
    private gateway: OrderGateway,
  ) {}

  async create(sellerUserId: string, body: any): Promise<any> {
    if (!body?.productId || !Types.ObjectId.isValid(body.productId)) {
      throw new BadRequestException('A valid productId is required');
    }
    const product = await this.productModel.findById(body.productId).select('groupBuyEligible sellerId marketId').lean().exec();
    if (!product) throw new NotFoundException('Product not found');
    if (!product.groupBuyEligible) throw new BadRequestException('This product is not eligible for group buying');

    const seller = await this.sellerModel.findOne({ userId: sellerUserId, deletedAt: null }).select('_id').lean().exec();
    if (!seller || String(seller._id) !== String(product.sellerId)) {
      throw new ForbiddenException('You can only create group buys for your own products');
    }

    const targetQty = Number(body.targetQty);
    const discountPercent = Number(body.discountPercent);
    if (!(targetQty >= 2)) throw new BadRequestException('targetQty must be at least 2');
    if (!(discountPercent >= 1 && discountPercent <= 70)) throw new BadRequestException('discountPercent must be 1–70');
    const deadline = new Date(body.deadline);
    if (!body.deadline || isNaN(deadline.getTime()) || deadline <= new Date()) {
      throw new BadRequestException('A future deadline is required');
    }

    return this.groupBuyModel.create({
      sellerId: product.sellerId,
      sellerUserId,
      productId: product._id,
      marketId: product.marketId,
      targetQty,
      currentQty: 0,
      discountPercent,
      deadline,
      status: 'open',
      participants: [],
    });
  }

  async list(query: { marketId?: string; productId?: string; status?: string }): Promise<any[]> {
    const q: any = { deletedAt: null };
    if (query.status) q.status = query.status;
    else q.status = 'open';
    if (query.marketId && Types.ObjectId.isValid(query.marketId)) q.marketId = new Types.ObjectId(query.marketId);
    if (query.productId && Types.ObjectId.isValid(query.productId)) q.productId = new Types.ObjectId(query.productId);

    const items = await this.groupBuyModel.find(q).sort({ deadline: 1 }).lean().exec();
    // Strip participants entirely from list responses.
    return items.map((g: any) => this.toPublic(g));
  }

  /** Public detail: never expose participant addresses or userIds. */
  async getPublic(id: string): Promise<any> {
    const g = await this.groupBuyModel.findById(id).lean().exec();
    if (!g) throw new NotFoundException('Group buy not found');
    return this.toPublic(g);
  }

  private toPublic(g: any): any {
    return {
      _id: g._id,
      sellerId: g.sellerId,
      productId: g.productId,
      marketId: g.marketId,
      targetQty: g.targetQty,
      currentQty: g.currentQty,
      discountPercent: g.discountPercent,
      deadline: g.deadline,
      status: g.status,
      participantCount: Array.isArray(g.participants) ? g.participants.length : 0,
      lockedAt: g.lockedAt,
      cancelledAt: g.cancelledAt,
      createdAt: g.createdAt,
    };
  }

  async join(id: string, buyerUserId: string, body: { qty?: number; deliveryAddress?: any }): Promise<any> {
    const qty = Number(body.qty) > 0 ? Math.round(Number(body.qty)) : 1;

    const g = await this.groupBuyModel.findById(id);
    if (!g) throw new NotFoundException('Group buy not found');
    if (g.status !== 'open') throw new BadRequestException('This group buy is not open');
    if (new Date(g.deadline) <= new Date()) throw new BadRequestException('This group buy has expired');

    const already = (g.participants || []).some((p: any) => String(p.userId) === String(buyerUserId));
    if (already) throw new BadRequestException('You have already joined this group buy');

    g.participants.push({
      userId: buyerUserId,
      qty,
      joinedAt: new Date(),
      // Address is stored privately for fulfillment; never returned to other participants.
      deliveryAddress: body.deliveryAddress,
    });
    g.currentQty = Number(g.currentQty || 0) + qty;
    await g.save();

    this.gateway.sendOrderUpdate({ event: 'group_buy:participant_joined', groupBuyId: String(g._id), currentQty: g.currentQty });
    this.emitToRoom(String(g._id), 'group_buy:participant_joined', { groupBuyId: String(g._id), currentQty: g.currentQty });

    if (g.currentQty >= g.targetQty) {
      await this.lockGroupBuy(String(g._id));
    }

    return this.toPublic((await this.groupBuyModel.findById(id).lean().exec()) || g);
  }

  async lockBySeller(id: string, sellerUserId: string): Promise<any> {
    const g = await this.groupBuyModel.findById(id).lean().exec();
    if (!g) throw new NotFoundException('Group buy not found');
    if (String(g.sellerUserId) !== String(sellerUserId)) {
      throw new ForbiddenException('Only the owner can lock this group buy');
    }
    if (g.currentQty < g.targetQty) {
      throw new BadRequestException('Target quantity has not been reached yet');
    }
    return this.lockGroupBuy(id);
  }

  /** Internal lock: create discounted transactions + a multi-stop delivery. */
  private async lockGroupBuy(id: string): Promise<any> {
    // Atomic guard: only the first lock attempt proceeds.
    const g = await this.groupBuyModel.findOneAndUpdate(
      { _id: id, status: 'open' },
      { $set: { status: 'locked', lockedAt: new Date() } },
      { new: true },
    );
    if (!g) return this.groupBuyModel.findById(id).lean().exec();

    const product = await this.productModel.findById(g.productId).select('name price unit sellerId marketId').lean().exec();
    const seller = await this.sellerModel.findById(g.sellerId).select('userId stallId shopDetails stallName marketId').lean().exec();
    const discountFactor = (100 - Number(g.discountPercent)) / 100;
    const unitPrice = Math.round(Number(product?.price || 0) * discountFactor);

    const dropoffs: any[] = [];
    for (const participant of g.participants || []) {
      try {
        const subtotal = unitPrice * Number(participant.qty || 1);
        const platformCommission = Math.max(Math.round(subtotal * 0.015), 100);
        const orderNumber = `GB-${String(g._id).slice(-6)}-${String(participant.userId).slice(-4)}-${Date.now()}`;
        const buyer = await this.userModel.findById(participant.userId).select('fullName phone').lean().exec();

        const tx = await this.orderModel.create({
          orderNumber,
          buyer: {
            userId: participant.userId,
            fullName: buyer?.fullName || 'Buyer',
            phone: buyer?.phone,
            deliveryAddress: participant.deliveryAddress,
          },
          seller: {
            sellerId: g.sellerId,
            userId: seller?.userId,
            fullName: seller?.shopDetails?.name || seller?.stallName || 'Seller',
            stallId: seller?.stallId || 'GB',
            marketId: g.marketId,
          },
          products: [{
            productId: g.productId,
            name: product?.name || 'Group buy item',
            unitPrice,
            quantity: Number(participant.qty || 1),
            unit: product?.unit,
          }],
          financials: {
            subtotal,
            deliveryFee: 0,
            platformCommission,
            gatewayFee: 0,
            totalAmount: subtotal,
            sellerPayout: subtotal - platformCommission,
            riderPayout: 0,
          },
          payment: { method: 'MOMO', status: 'pending' },
          status: OrderStatus.PLACED,
          orderSource: 'group_buy',
          groupBuyId: g._id,
        });

        participant.orderId = tx._id;
        if (participant.deliveryAddress?.coordinates) {
          dropoffs.push({
            address: participant.deliveryAddress.address,
            coordinates: participant.deliveryAddress.coordinates,
            buyerId: participant.userId,
            status: 'pending',
          });
        }
      } catch (err: any) {
        this.logger.error(`Group buy participant order failed: ${err?.message}`);
      }
    }

    // Persist participant orderIds.
    await this.groupBuyModel.findByIdAndUpdate(g._id, { $set: { participants: g.participants } });

    // Create a multi-stop group-buy delivery (best-effort).
    try {
      const deliveryUrl = process.env.DELIVERY_SERVICE_URL || 'http://localhost:3008/api/v1';
      const secret = process.env.INTERNAL_SERVICE_SECRET;
      const headers = secret ? { 'x-internal-service-key': secret } : {};
      if (dropoffs.length) {
        const res = await axios.post(`${deliveryUrl}/deliveries`, {
          orderId: g._id,
          orderNumber: `GB-${String(g._id).slice(-6)}`,
          deliveryType: 'group_buy',
          pickup: { marketId: g.marketId, stallId: seller?.stallId || 'GB', coordinates: { lat: -1.9441, lng: 30.0619 } },
          dropoff: dropoffs[0],
          dropoffs,
        }, { headers }).catch(() => null);
        const deliveryId = res?.data?.data?._id;
        if (deliveryId) await this.groupBuyModel.findByIdAndUpdate(g._id, { $set: { deliveryId } });
      }
    } catch (err: any) {
      this.logger.warn(`Group buy delivery creation failed: ${err?.message}`);
    }

    this.emitToRoom(String(g._id), 'group_buy:locked', { groupBuyId: String(g._id) });
    this.notifyParticipants(g, 'group_buy.locked');
    return this.toPublic((await this.groupBuyModel.findById(g._id).lean().exec()) || g);
  }

  /** Cron-driven expiry: cancel open group buys whose deadline passed without hitting target. */
  async expireOpenGroupBuys(): Promise<{ cancelled: number }> {
    const now = new Date();
    const expiring = await this.groupBuyModel.find({ status: 'open', deadline: { $lt: now }, deletedAt: null }).exec();
    let cancelled = 0;
    for (const g of expiring) {
      if (g.currentQty < g.targetQty) {
        g.status = 'cancelled';
        g.cancelledAt = now;
        g.cancelReason = 'Deadline passed — minimum quantity not reached';
        await g.save();
        this.emitToRoom(String(g._id), 'group_buy:cancelled', { groupBuyId: String(g._id) });
        this.notifyParticipants(g, 'group_buy.cancelled');
        cancelled++;
      }
    }
    return { cancelled };
  }

  private emitToRoom(groupBuyId: string, event: string, payload: any): void {
    try {
      this.gateway.server?.to(`group_buy:${groupBuyId}`).emit(event, payload);
    } catch {
      /* gateway may be unavailable in tests */
    }
  }

  private notifyParticipants(g: any, type: string): void {
    const url = `${process.env.NOTIFICATION_SERVICE_URL || 'http://localhost:3009/api/v1'}/notifications/dispatch`;
    const secret = process.env.INTERNAL_SERVICE_SECRET;
    const headers = secret ? { 'x-internal-service-key': secret } : {};
    for (const p of g.participants || []) {
      axios.post(url, { userId: String(p.userId), type, params: { groupBuyId: String(g._id) }, channels: ['IN_APP'] }, { headers }).catch(() => {});
    }
  }
}
