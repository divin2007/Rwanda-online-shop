import { Module } from '@nestjs/common';
import { ScheduleModule } from '@nestjs/schedule';
import { APP_FILTER } from '@nestjs/core';
import { MongooseModule } from '@nestjs/mongoose';
import { HealthCheckModule } from '@rmf/health-check';
import { AuthGuardModule } from '@rmf/auth';
import { OrderModule } from './order/order.module';
import { AppErrorFilter } from './app-error.filter';

@Module({
  imports: [
    ScheduleModule.forRoot(),
    MongooseModule.forRoot(process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/market_rwanda'),
    HealthCheckModule,
    AuthGuardModule.forRoot(),
    OrderModule
  ],
  providers: [
    { provide: APP_FILTER, useClass: AppErrorFilter }
  ],
})
export class AppModule {}
