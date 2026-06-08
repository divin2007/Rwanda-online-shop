import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { ThrottlerModule } from '@nestjs/throttler';
import { HealthCheckModule } from '@rmf/health-check';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { AuthModule } from './auth/auth.module';
import { UsersModule } from './users/users.module';
import { AffiliateModule } from './affiliate/affiliate.module';
import { B2bModule } from './b2b/b2b.module';

@Module({
  imports: [
    MongooseModule.forRoot(process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/market_rwanda'),
    ThrottlerModule.forRoot([{
      ttl: 60000,
      limit: 1000,
    }]),
    HealthCheckModule,
    AuthModule,
    UsersModule,
    AffiliateModule,
    B2bModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
