import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import {
  sellerProfileSchema,
  marketSchema,
  transactionSchema,
  auditLogSchema
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
      { name: 'AuditLog', schema: auditLogSchema }
    ]),
    AuthGuardModule.forRoot(),
  ],
  providers: [AdminService],
  controllers: [AdminController],
  exports: [AdminService],
})
export class AdminModule {}
