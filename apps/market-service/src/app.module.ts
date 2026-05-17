import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { HealthCheckModule } from '@rmf/health-check';
import { ContractsModule } from './contracts/contracts.module';
import { MarketModule } from './market/market.module';

@Module({
  imports: [
    MongooseModule.forRoot(process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/market_rwanda'),
    HealthCheckModule,
    MarketModule, ContractsModule,
  ],
})
export class AppModule {}
