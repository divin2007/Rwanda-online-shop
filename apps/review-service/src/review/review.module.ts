import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { reviewSchema, sellerProfileSchema, riderProfileSchema } from '@rmf/database';
import { ReviewService } from './review.service';
import { ReviewController } from './review.controller';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: 'Review', schema: reviewSchema },
      { name: 'SellerProfile', schema: sellerProfileSchema },
      { name: 'RiderProfile', schema: riderProfileSchema }
    ]),
  ],
  providers: [ReviewService],
  controllers: [ReviewController],
  exports: [ReviewService],
})
export class ReviewModule {}
