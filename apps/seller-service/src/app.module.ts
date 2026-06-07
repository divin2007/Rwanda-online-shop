import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { HealthCheckModule } from '@rmf/health-check';
import { SellerModule } from './seller/seller.module';
import { MenuModule } from './menu/menu.module';
import { ExportModule } from './export/export.module';
import { LiveSessionModule } from './live/live-session.module';

@Module({
  imports: [
    MongooseModule.forRoot(process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/market_rwanda'),
    HealthCheckModule,
    SellerModule,
    MenuModule,
    ExportModule,
    LiveSessionModule
  ],
})
export class AppModule {}
