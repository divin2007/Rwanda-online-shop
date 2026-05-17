import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { marketSchema } from '@rmf/database';
import { MarketService } from './market.service';
import { MarketController } from './market.controller';
import { CacheModule } from '@nestjs/cache-manager';
import KeyvRedis, { createClient } from '@keyv/redis';
import { Keyv } from 'keyv';

const createRedisCache = (namespace: string) => {
  const redisUrl = process.env.REDIS_URL || `redis://${process.env.REDIS_HOST || '127.0.0.1'}:${process.env.REDIS_PORT || '6379'}`;
  const client = createClient({
    url: redisUrl,
    socket: {
      reconnectStrategy: retries => Math.min(retries * 100, 2000),
    },
  });

  client.on('error', error => {
    console.warn(`[${namespace}] Redis cache unavailable: ${error.message}`);
  });

  const adapter = new KeyvRedis(client as unknown as ConstructorParameters<typeof KeyvRedis>[0], {
    namespace,
    throwOnConnectError: false,
    throwErrors: false,
    connectionTimeout: 1500,
  });
  const cache = new Keyv(adapter, { namespace, useKeyPrefix: false });

  cache.on('error', error => {
    console.warn(`[${namespace}] Cache operation skipped: ${error.message}`);
  });

  return cache;
};

@Module({
  imports: [
    CacheModule.register({
      stores: [
        createRedisCache('market-cache'),
      ],
    }),
    MongooseModule.forFeature([{ name: 'Market', schema: marketSchema }]),
  ],
  providers: [MarketService],
  controllers: [MarketController],
  exports: [MarketService],
})
export class MarketModule {}
