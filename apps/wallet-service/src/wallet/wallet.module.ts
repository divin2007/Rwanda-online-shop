import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { walletSchema, ledgerEntrySchema, payoutRequestSchema } from '@rmf/database';
import { AuthGuardModule } from '@rmf/auth';
import { WalletService } from './wallet.service';
import { WalletController } from './wallet.controller';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: 'Wallet', schema: walletSchema },
      { name: 'LedgerEntry', schema: ledgerEntrySchema },
      { name: 'PayoutRequest', schema: payoutRequestSchema }
    ]),
    AuthGuardModule.forRoot(),
  ],
  providers: [WalletService],
  controllers: [WalletController],
  exports: [WalletService],
})
export class WalletModule {}
