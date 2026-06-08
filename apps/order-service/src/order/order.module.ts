import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { transactionSchema, marketSchema, sellerProfileSchema, userSchema, productSchema, deliverySchema, ledgerEntrySchema } from '@rmf/database';
import { OrderService } from './order.service';
import { OrderController } from './order.controller';
import { FraudDetectionService } from './fraud-detection.service';
import { BuyerProtectionService } from './buyer-protection.service';
import { ScheduledOrdersService } from './scheduled-orders.service';

import { MulterModule } from '@nestjs/platform-express';
import { OrderGateway } from './order.gateway';
import { PaymentService } from './payment.service';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: 'Transaction', schema: transactionSchema },
      { name: 'Market', schema: marketSchema },
      { name: 'SellerProfile', schema: sellerProfileSchema },
      { name: 'User', schema: userSchema },
      { name: 'Product', schema: productSchema },
      { name: 'Delivery', schema: deliverySchema },
      { name: 'LedgerEntry', schema: ledgerEntrySchema },
    ]),
    MulterModule.register({})
  ],
  providers: [OrderService, FraudDetectionService, ScheduledOrdersService, BuyerProtectionService, OrderGateway, PaymentService],
  controllers: [OrderController],
  exports: [OrderService, OrderGateway, PaymentService],
})
export class OrderModule {}
