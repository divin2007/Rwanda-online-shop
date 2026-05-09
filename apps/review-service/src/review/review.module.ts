import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { reviewSchema, sellerProfileSchema, riderProfileSchema, marketSchema, productSchema } from '@rmf/database';
import { ReviewService } from './review.service';
import { ReviewController } from './review.controller';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: 'Review', schema: reviewSchema },
      { name: 'SellerProfile', schema: sellerProfileSchema },
      { name: 'RiderProfile', schema: riderProfileSchema },
      { name: 'Market', schema: marketSchema },
      { name: 'Product', schema: productSchema }
    ]),
  ],
  providers: [ReviewService],
  controllers: [ReviewController],
  exports: [ReviewService],
})
export class ReviewModule {}
