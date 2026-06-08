import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { liveSessionSchema, sellerVideoSchema, sellerProfileSchema, transactionSchema } from '@rmf/database';
import { AuthGuardModule } from '@rmf/auth';
import { LiveSessionService } from './live-session.service';
import { LiveSessionController } from './live-session.controller';
import { LiveGateway } from './live.gateway';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: 'LiveSession', schema: liveSessionSchema },
      { name: 'SellerVideo', schema: sellerVideoSchema },
      { name: 'SellerProfile', schema: sellerProfileSchema },
      { name: 'Transaction', schema: transactionSchema },
    ]),
    AuthGuardModule.forRoot(),
  ],
  providers: [LiveSessionService, LiveGateway],
  controllers: [LiveSessionController],
})
export class LiveSessionModule {}
