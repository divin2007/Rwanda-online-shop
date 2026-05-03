import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { transactionSchema } from '@rmf/database';
import { OrderService } from './order.service';
import { OrderController } from './order.controller';
import { FraudDetectionService } from './fraud-detection.service';
import { BuyerProtectionService } from './buyer-protection.service';
import { ScheduledOrdersService } from './scheduled-orders.service';

import { OrderGateway } from './order.gateway';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: 'Transaction', schema: transactionSchema }
    ]),
  ],
  providers: [OrderService, FraudDetectionService, ScheduledOrdersService, BuyerProtectionService, OrderGateway],
  controllers: [OrderController],
  exports: [OrderService, OrderGateway],
})
export class OrderModule {}
