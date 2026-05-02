import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { sellerProfileSchema, marketSchema } from '@rmf/database';
import { SellerService } from './seller.service';
import { SellerController } from './seller.controller';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: 'SellerProfile', schema: sellerProfileSchema },
      { name: 'Market', schema: marketSchema }
    ]),
  ],
  providers: [SellerService],
  controllers: [SellerController],
  exports: [SellerService],
})
export class SellerModule {}
