import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { deliverySchema } from '@rmf/database';
import { DeliveryService } from './delivery.service';
import { DeliveryController } from './delivery.controller';
import { DeliveryGateway } from './delivery.gateway';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: 'Delivery', schema: deliverySchema }
    ]),
  ],
  providers: [DeliveryService, DeliveryGateway],
  controllers: [DeliveryController],
  exports: [DeliveryService],
})
export class DeliveryModule {}
