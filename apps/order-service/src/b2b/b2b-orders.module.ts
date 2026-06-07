import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import {
  recurringOrderTemplateSchema,
  invoiceSchema,
  transactionSchema,
  b2bAccountSchema,
  sellerProfileSchema,
  productSchema,
} from '@rmf/database';
import { AuthGuardModule } from '@rmf/auth';
import { B2bOrdersService } from './b2b-orders.service';
import { B2bOrdersController } from './b2b-orders.controller';
import { B2bRecurringService } from './b2b-recurring.service';
import { InvoiceGenerationService } from './invoice-generation.service';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: 'RecurringOrderTemplate', schema: recurringOrderTemplateSchema },
      { name: 'Invoice', schema: invoiceSchema },
      { name: 'Transaction', schema: transactionSchema },
      { name: 'B2BAccount', schema: b2bAccountSchema },
      { name: 'SellerProfile', schema: sellerProfileSchema },
      { name: 'Product', schema: productSchema },
    ]),
    AuthGuardModule.forRoot(),
  ],
  providers: [B2bOrdersService, B2bRecurringService, InvoiceGenerationService],
  controllers: [B2bOrdersController],
})
export class B2bOrdersModule {}
