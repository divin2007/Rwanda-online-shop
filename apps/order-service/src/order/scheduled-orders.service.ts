import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import axios from 'axios';
import { OrderStatus } from '@rmf/shared-types';

@Injectable()
export class ScheduledOrdersService {
  private readonly logger = new Logger(ScheduledOrdersService.name);

  constructor(
    @InjectModel('Transaction') private orderModel: Model<any>,
    @InjectModel('GroupBuy') private groupBuyModel: Model<any>
  ) {}

  // Group Buying (Feature 1): hourly expiry of open group buys that miss their target.
  @Cron('0 * * * *')
  async expireGroupBuys() {
    const now = new Date();
    const expiring = await this.groupBuyModel.find({ status: 'open', deadline: { $lt: now }, deletedAt: null }).exec();
    let cancelled = 0;
    for (const g of expiring) {
      if (Number(g.currentQty || 0) < Number(g.targetQty || 0)) {
        g.status = 'cancelled';
        g.cancelledAt = now;
        g.cancelReason = 'Deadline passed — minimum quantity not reached';
        await g.save();
        this.notifyGroupBuyParticipants(g, 'group_buy.cancelled');
        cancelled++;
      }
    }
    if (cancelled) this.logger.log(`Cancelled ${cancelled} expired group buy(s).`);
  }

  private notifyGroupBuyParticipants(g: any, type: string) {
    const url = `${process.env.NOTIFICATION_SERVICE_URL || 'http://localhost:3009/api/v1'}/notifications/dispatch`;
    const secret = process.env.INTERNAL_SERVICE_SECRET;
    const headers = secret ? { 'x-internal-service-key': secret } : {};
    for (const p of g.participants || []) {
      axios.post(url, { userId: String(p.userId), type, params: { groupBuyId: String(g._id) }, channels: ['IN_APP'] }, { headers }).catch(() => {});
    }
  }

  @Cron('0 6 * * *')
  async executeScheduledOrders() {
    this.logger.log('Executing 06:00 scheduled orders check...');
    const now = new Date();
    
    // Find scheduled orders where nextRun is due
    const dueOrders = await this.orderModel.find({
      status: OrderStatus.SCHEDULED,
      'schedule.nextRun': { $lte: now }
    }).exec();

    for (const order of dueOrders) {
      try {
        const nextRun = this.calculateNextRun(order.schedule?.nextRun || now, order.schedule?.frequency);

        if (nextRun) {
          const nextOrder = order.toObject();
          delete nextOrder._id;
          delete nextOrder.createdAt;
          delete nextOrder.updatedAt;
          nextOrder.orderNumber = `${order.orderNumber}-R${Date.now()}`;
          nextOrder.status = OrderStatus.SCHEDULED;
          nextOrder.schedule = { ...nextOrder.schedule, nextRun };
          nextOrder.statusHistory = [{
            status: OrderStatus.SCHEDULED,
            changedAt: new Date(),
            note: `Next scheduled occurrence created from ${order.orderNumber}`
          }];
          await new this.orderModel(nextOrder).save();
        }

        await this.orderModel.findByIdAndUpdate(order._id, {
          $set: {
            status: OrderStatus.PLACED
          }
        });
        this.logger.log(`Triggered scheduled order: ${order.orderNumber}`);
      } catch (err) {
        this.logger.error(`Failed to process scheduled order ${order.orderNumber}`, err);
      }
    }
  }

  private calculateNextRun(current: Date, frequency?: string): Date | null {
    if (!frequency || frequency === 'once') return null;

    const next = new Date(current);
    switch (frequency) {
      case 'daily':
        next.setDate(next.getDate() + 1);
        break;
      case 'monthly':
        next.setMonth(next.getMonth() + 1);
        break;
      case 'weekly':
      default:
        next.setDate(next.getDate() + 7);
        break;
    }
    return next;
  }
}
