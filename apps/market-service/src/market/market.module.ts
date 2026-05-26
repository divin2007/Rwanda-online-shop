import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { marketSchema } from '@rmf/database';
import { AuthGuardModule } from '@rmf/auth';
import { MarketService } from './market.service';
import { MarketController } from './market.controller';
import { CacheModule } from '@nestjs/cache-manager';
import KeyvRedis, { createClient } from '@keyv/redis';
import { Keyv } from 'keyv';
import { StorageModule } from '../storage/storage.module';

const createRedisCache = (namespace: string) => {
  const redisUrl = process.env.REDIS_URL?.trim()
    || (process.env.REDIS_HOST?.trim()
      ? `redis://${process.env.REDIS_HOST.trim()}:${process.env.REDIS_PORT || '6379'}`
      : undefined);

  if (!redisUrl) {
    console.warn(`[${namespace}] Redis cache disabled: REDIS_URL is not configured.`);
    return undefined;
  }

  const connectTimeout = Number(process.env.REDIS_CONNECT_TIMEOUT_MS || 1000);
  const client = createClient({
    url: redisUrl,
    socket: {
      connectTimeout,
      reconnectStrategy: retries => (retries > 2 ? false : Math.min(retries * 100, 1000)),
    },
  });

  client.on('error', error => {
    console.warn(`[${namespace}] Redis cache unavailable: ${error.message}`);
  });

  const adapter = new KeyvRedis(client as unknown as ConstructorParameters<typeof KeyvRedis>[0], {
    namespace,
    throwOnConnectError: false,
    throwErrors: false,
    connectionTimeout: connectTimeout,
  });
  const cache = new Keyv(adapter, { namespace, useKeyPrefix: false });

  cache.on('error', error => {
    console.warn(`[${namespace}] Cache operation skipped: ${error.message}`);
  });

  return cache;
};

const marketCache = createRedisCache('market-cache');

@Module({
  imports: [
    StorageModule,
    AuthGuardModule.forRoot(),
    CacheModule.register({
      ...(marketCache ? { stores: [marketCache] } : {}),
    }),
    MongooseModule.forFeature([{ name: 'Market', schema: marketSchema }]),
  ],
  providers: [MarketService],
  controllers: [MarketController],
  exports: [MarketService],
})
export class MarketModule {}
