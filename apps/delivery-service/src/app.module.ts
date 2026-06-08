import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { HealthCheckModule } from '@rmf/health-check';
import { DeliveryModule } from './delivery/delivery.module';

@Module({
  imports: [
    MongooseModule.forRoot(process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/market_rwanda'),
    HealthCheckModule,
    DeliveryModule
  ],
})
export class AppModule {}
