import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { marketSchema } from '@rmf/database';
import { MarketService } from './market.service';
import { MarketController } from './market.controller';
import { CacheModule } from '@nestjs/cache-manager';
import { createKeyv } from '@keyv/redis';

@Module({
  imports: [
    CacheModule.register({
      stores: [
        createKeyv({
          socket: {
            host: process.env.REDIS_HOST || 'localhost',
            port: parseInt(process.env.REDIS_PORT || '6379'),
          },
        }),
      ],
    }),
    MongooseModule.forFeature([{ name: 'Market', schema: marketSchema }]),
  ],
  providers: [MarketService],
  controllers: [MarketController],
  exports: [MarketService],
})
export class MarketModule {}
