import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { OrderStatus } from '@rmf/shared-types';

@Injectable()
export class ScheduledOrdersService {
  private readonly logger = new Logger(ScheduledOrdersService.name);

  constructor(
    @InjectModel('Transaction') private orderModel: Model<any>
  ) {}

  // In a real nest app we'd use @nestjs/schedule and @Cron('0 6 * * *')
  // We're stubbing the execution handler that cron would call.
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
        // Transition to placed so it enters normal fulfillment flow
        await this.orderModel.findByIdAndUpdate(order._id, {
          $set: { status: OrderStatus.PLACED },
          // Advance the next run by 7 days
          $inc: { 'schedule.nextRun': 7 * 24 * 60 * 60 * 1000 }
        });
        this.logger.log(`Triggered scheduled order: ${order.orderNumber}`);
      } catch (err) {
        this.logger.error(`Failed to process scheduled order ${order.orderNumber}`, err);
      }
    }
  }
}
