import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { HealthCheckModule } from '@rmf/health-check';
import { ProductModule } from './product/product.module';
import { PromotionModule } from './promotion/promotion.module';

@Module({
  imports: [
    MongooseModule.forRoot(process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/market_rwanda'),
    HealthCheckModule,
    ProductModule,
    PromotionModule
  ],
})
export class AppModule {}
