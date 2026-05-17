import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { HealthCheckModule } from '@rmf/health-check';
import { WalletModule } from './wallet/wallet.module';

@Module({
  imports: [
    MongooseModule.forRoot(process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/market_rwanda'),
    HealthCheckModule,
    WalletModule
  ],
})
export class AppModule {}
