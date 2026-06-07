import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { exportInquirySchema, productSchema, sellerProfileSchema, userSchema } from '@rmf/database';
import { AuthGuardModule } from '@rmf/auth';
import { ExportService } from './export.service';
import { ExportController, SellerExportController } from './export.controller';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: 'ExportInquiry', schema: exportInquirySchema },
      { name: 'Product', schema: productSchema },
      { name: 'SellerProfile', schema: sellerProfileSchema },
      { name: 'User', schema: userSchema },
    ]),
    AuthGuardModule.forRoot(),
  ],
  providers: [ExportService],
  controllers: [ExportController, SellerExportController],
})
export class ExportModule {}
