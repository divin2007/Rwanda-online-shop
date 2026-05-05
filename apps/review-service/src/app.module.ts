import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { HealthCheckModule } from '@rmf/health-check';
import { ReviewModule } from './review/review.module';

@Module({
  imports: [
    MongooseModule.forRoot(process.env.MONGODB_URI || 'mongodb://localhost:27017/market_rwanda'),
    HealthCheckModule,
    ReviewModule
  ],
})
export class AppModule {}
