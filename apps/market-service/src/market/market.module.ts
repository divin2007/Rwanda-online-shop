import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { marketSchema } from '@rmf/database';
import { MarketService } from './market.service';
import { MarketController } from './market.controller';
import { CacheModule } from '@nestjs/cache-manager';

@Module({
  imports: [
    CacheModule.register(),
    MongooseModule.forFeature([{ name: 'Market', schema: marketSchema }]),
  ],
  providers: [MarketService],
  controllers: [MarketController],
  exports: [MarketService],
})
export class MarketModule {}
