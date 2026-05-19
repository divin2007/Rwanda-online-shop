import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { productSchema, sellerProfileSchema, marketSchema, promotionSchema, taxonomyCategorySchema, sellerVideoSchema, userSchema } from '@rmf/database';
import { AuthGuardModule } from '@rmf/auth';
import { ProductService } from './product.service';
import { ProductController } from './product.controller';
import { SellerVideoController } from '../seller-video/seller-video.controller';
import { SellerVideoService } from '../seller-video/seller-video.service';
import { CacheModule } from '@nestjs/cache-manager';
import KeyvRedis, { createClient } from '@keyv/redis';
import { Keyv } from 'keyv';
import { StorageModule } from '../storage/storage.module';

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
    // Dev machines can be busy while Docker Redis is waking up. A 1.5s timeout
    // closes the client while node-redis can still receive replies, which can
    // crash cache-backed services. Keep cache optional but give Redis time to connect.
    connectionTimeout: 10000,
  });
  const cache = new Keyv(adapter, { namespace, useKeyPrefix: false });

  cache.on('error', error => {
    console.warn(`[${namespace}] Cache operation skipped: ${error.message}`);
  });

  return cache;
};

@Module({
  imports: [
    StorageModule,
    AuthGuardModule.forRoot(),
    CacheModule.register({
      stores: [
        createRedisCache('product-cache'),
      ],
    }),
    MongooseModule.forFeature([
      { name: 'Product', schema: productSchema },
      { name: 'SellerProfile', schema: sellerProfileSchema },
      { name: 'Market', schema: marketSchema },
      { name: 'Promotion', schema: promotionSchema },
      { name: 'TaxonomyCategory', schema: taxonomyCategorySchema },
      { name: 'SellerVideo', schema: sellerVideoSchema },
      { name: 'User', schema: userSchema }
    ]),
  ],
  providers: [ProductService, SellerVideoService],
  controllers: [ProductController, SellerVideoController],
  exports: [ProductService],
})
export class ProductModule {}
