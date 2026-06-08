import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { sellerProfileSchema, marketSchema, profileChangeRequestSchema } from '@rmf/database';
import { AuthGuardModule } from '@rmf/auth';
import { SellerService } from './seller.service';
import { SellerController } from './seller.controller';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: 'SellerProfile', schema: sellerProfileSchema },
      { name: 'Market', schema: marketSchema },
      { name: 'ProfileChangeRequest', schema: profileChangeRequestSchema }
    ]),
    AuthGuardModule.forRoot(),
  ],
  providers: [SellerService],
  controllers: [SellerController],
  exports: [SellerService],
})
export class SellerModule {}
