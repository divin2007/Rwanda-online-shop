import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import {
  cateringBriefSchema,
  cateringBidSchema,
  transactionSchema,
  b2bAccountSchema,
  sellerProfileSchema,
  recurringOrderTemplateSchema,
} from '@rmf/database';
import { AuthGuardModule } from '@rmf/auth';
import { CateringService } from './catering.service';
import { CateringController } from './catering.controller';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: 'CateringBrief', schema: cateringBriefSchema },
      { name: 'CateringBid', schema: cateringBidSchema },
      { name: 'Transaction', schema: transactionSchema },
      { name: 'B2BAccount', schema: b2bAccountSchema },
      { name: 'SellerProfile', schema: sellerProfileSchema },
      { name: 'RecurringOrderTemplate', schema: recurringOrderTemplateSchema },
    ]),
    AuthGuardModule.forRoot(),
  ],
  providers: [CateringService],
  controllers: [CateringController],
})
export class CateringModule {}
