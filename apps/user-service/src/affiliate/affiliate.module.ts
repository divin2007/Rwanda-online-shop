import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { PassportModule } from '@nestjs/passport';
import {
  affiliateProfileSchema,
  referralLinkSchema,
  affiliateApplicationSchema,
  userSchema,
  productSchema,
  sellerProfileSchema,
  ledgerEntrySchema,
} from '@rmf/database';
import { AffiliateService } from './affiliate.service';
import { AffiliateController } from './affiliate.controller';
import { ReferralRedirectController } from './referral-redirect.controller';

@Module({
  imports: [
    PassportModule,
    MongooseModule.forFeature([
      { name: 'AffiliateProfile', schema: affiliateProfileSchema },
      { name: 'ReferralLink', schema: referralLinkSchema },
      { name: 'AffiliateApplication', schema: affiliateApplicationSchema },
      { name: 'User', schema: userSchema },
      { name: 'Product', schema: productSchema },
      { name: 'SellerProfile', schema: sellerProfileSchema },
      { name: 'LedgerEntry', schema: ledgerEntrySchema },
    ]),
  ],
  providers: [AffiliateService],
  controllers: [AffiliateController, ReferralRedirectController],
  exports: [AffiliateService],
})
export class AffiliateModule {}
