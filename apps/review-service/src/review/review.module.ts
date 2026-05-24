import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { reviewSchema, sellerProfileSchema, riderProfileSchema, marketSchema, productSchema, transactionSchema, deliverySchema } from '@rmf/database';
import { AuthGuardModule } from '@rmf/auth';
import { ReviewService } from './review.service';
import { ReviewController } from './review.controller';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: 'Review', schema: reviewSchema },
      { name: 'SellerProfile', schema: sellerProfileSchema },
      { name: 'RiderProfile', schema: riderProfileSchema },
      { name: 'Market', schema: marketSchema },
      { name: 'Product', schema: productSchema },
      { name: 'Transaction', schema: transactionSchema },
      { name: 'Delivery', schema: deliverySchema }
    ]),
    AuthGuardModule.forRoot(),
  ],
  providers: [ReviewService],
  controllers: [ReviewController],
  exports: [ReviewService],
})
export class ReviewModule {}
