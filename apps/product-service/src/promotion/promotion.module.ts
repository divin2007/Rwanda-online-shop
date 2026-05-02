import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { promotionSchema, productSchema } from '@rmf/database';
import { PromotionService } from './promotion.service';
import { PromotionController } from './promotion.controller';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: 'Promotion', schema: promotionSchema },
      { name: 'Product', schema: productSchema }
    ]),
  ],
  providers: [PromotionService],
  controllers: [PromotionController],
  exports: [PromotionService],
})
export class PromotionModule {}
