import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { transactionSchema } from '@rmf/database';
import { OrderService } from './order.service';
import { OrderController } from './order.controller';
import { FraudDetectionService } from './fraud-detection.service';
import { BuyerProtectionService } from './buyer-protection.service';
import { ScheduledOrdersService } from './scheduled-orders.service';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: 'Transaction', schema: transactionSchema }
    ]),
  ],
  providers: [OrderService, FraudDetectionService, ScheduledOrdersService, BuyerProtectionService],
  controllers: [OrderController],
  exports: [OrderService],
})
export class OrderModule {}
