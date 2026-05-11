import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { deliverySchema, riderProfileSchema, transactionSchema, userSchema, marketSchema } from '@rmf/database';
import { DeliveryService } from './delivery.service';
import { DeliveryController } from './delivery.controller';
import { DeliveryGateway } from './delivery.gateway';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: 'Delivery', schema: deliverySchema },
      { name: 'RiderProfile', schema: riderProfileSchema },
      { name: 'Transaction', schema: transactionSchema },
      { name: 'User', schema: userSchema },
      { name: 'Market', schema: marketSchema },
    ]),
    // Auth guard removed: delivery-service is internal-only (called by order-service)
    // The WebSocket gateway handles its own connection security
  ],
  providers: [DeliveryService, DeliveryGateway],
  controllers: [DeliveryController],
  exports: [DeliveryService],
})
export class DeliveryModule {}
