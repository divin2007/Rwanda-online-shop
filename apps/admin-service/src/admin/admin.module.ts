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
  ledgerEntrySchema
} from '@rmf/database';
import { AuthGuardModule } from '@rmf/auth';
import { AdminService } from './admin.service';
import { AdminController } from './admin.controller';

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
      { name: 'LedgerEntry', schema: ledgerEntrySchema }
    ]),
    AuthGuardModule.forRoot(),
  ],
  providers: [AdminService],
  controllers: [AdminController],
  exports: [AdminService],
})
export class AdminModule {}
