import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { bulkDeliveryRequestSchema, b2bAccountSchema, riderProfileSchema } from '@rmf/database';
import { AuthGuardModule } from '@rmf/auth';
import { BulkDeliveryService } from './bulk-delivery.service';
import { BulkDeliveryController } from './bulk-delivery.controller';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: 'BulkDeliveryRequest', schema: bulkDeliveryRequestSchema },
      { name: 'B2BAccount', schema: b2bAccountSchema },
      { name: 'RiderProfile', schema: riderProfileSchema },
    ]),
    AuthGuardModule.forRoot(),
  ],
  providers: [BulkDeliveryService],
  controllers: [BulkDeliveryController],
})
export class BulkDeliveryModule {}
