import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { sellerProfileSchema, marketSchema, profileChangeRequestSchema, affiliateApplicationSchema } from '@rmf/database';
import { AuthGuardModule } from '@rmf/auth';
import { SellerService } from './seller.service';
import { SellerController } from './seller.controller';
import { FreshnessService } from './freshness.service';
import { FreshnessController } from './freshness.controller';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: 'SellerProfile', schema: sellerProfileSchema },
      { name: 'Market', schema: marketSchema },
      { name: 'ProfileChangeRequest', schema: profileChangeRequestSchema },
      { name: 'AffiliateApplication', schema: affiliateApplicationSchema }
    ]),
    AuthGuardModule.forRoot(),
  ],
  providers: [SellerService, FreshnessService],
  controllers: [SellerController, FreshnessController],
  exports: [SellerService],
})
export class SellerModule {}
