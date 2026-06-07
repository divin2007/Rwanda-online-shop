import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import {
  sellerProfileSchema,
  marketSchema,
  transactionSchema,
  auditLogSchema,
  deliverySchema,
  reviewSchema,
  supportTicketSchema,
  sellerVideoSchema,
  notificationLogSchema,
  ledgerEntrySchema,
  priceIndexSchema,
  userSchema,
  exportInquirySchema,
  b2bAccountSchema
} from '@rmf/database';
import { AuthGuardModule } from '@rmf/auth';
import { AdminService } from './admin.service';
import { TierCalculationService } from './tier-calculation.service';
import { PriceIndexService } from './price-index.service';
import { AdminController } from './admin.controller';
import { PriceIndexController } from './price-index.controller';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: 'SellerProfile', schema: sellerProfileSchema },
      { name: 'Market', schema: marketSchema },
      { name: 'Transaction', schema: transactionSchema },
      { name: 'AuditLog', schema: auditLogSchema },
      { name: 'Delivery', schema: deliverySchema },
      { name: 'Review', schema: reviewSchema },
      { name: 'SupportTicket', schema: supportTicketSchema },
      { name: 'SellerVideo', schema: sellerVideoSchema },
      { name: 'NotificationLog', schema: notificationLogSchema },
      { name: 'LedgerEntry', schema: ledgerEntrySchema },
      { name: 'PriceIndex', schema: priceIndexSchema },
      { name: 'User', schema: userSchema },
      { name: 'ExportInquiry', schema: exportInquirySchema },
      { name: 'B2BAccount', schema: b2bAccountSchema }
    ]),
    AuthGuardModule.forRoot(),
  ],
  providers: [AdminService, TierCalculationService, PriceIndexService],
  controllers: [AdminController, PriceIndexController],
  exports: [AdminService],
})
export class AdminModule {}
