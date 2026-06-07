import { Module } from '@nestjs/common';
import { ScheduleModule } from '@nestjs/schedule';
import { MongooseModule } from '@nestjs/mongoose';
import { HealthCheckModule } from '@rmf/health-check';
import { AdminModule } from './admin/admin.module';

@Module({
  imports: [
    // The admin service needs to read from multiple DBs for aggregations/approvals.
    // In a microservice ecosystem, this would usually be done via API calls,
    // or through an event stream to a read-optimized DB (CQRS).
    // For this boilerplate, we'll connect to the main relevant schemas directly.
    ScheduleModule.forRoot(), // weekly tier + price-index cron jobs (Features 11 & 10)
    MongooseModule.forRoot(process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/market_rwanda'),
    HealthCheckModule,
    AdminModule
  ],
})
export class AppModule {}
