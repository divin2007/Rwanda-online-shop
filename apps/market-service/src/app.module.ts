import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { ContractsModule } from './contracts/contracts.module';
import { MarketModule } from './market/market.module';

@Module({
  imports: [
    MongooseModule.forRoot(process.env.MONGODB_URI || 'mongodb://localhost:27017/rmf_market'),
    MarketModule, ContractsModule,
  ],
})
export class AppModule {}
