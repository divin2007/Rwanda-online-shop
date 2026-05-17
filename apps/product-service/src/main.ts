import { NestFactory } from '@nestjs/core';
import { json, static as serveStatic, urlencoded } from 'express';
import { existsSync, mkdirSync } from 'fs';
import { join } from 'path';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  // Increase payload limit for large product images/data
  app.use(json({ limit: '100mb' }));
  app.use(urlencoded({ extended: true, limit: '100mb' }));
  const uploadRoot = join(process.cwd(), 'uploads');
  if (!existsSync(uploadRoot)) mkdirSync(uploadRoot, { recursive: true });
  app.use('/uploads', serveStatic(uploadRoot));

  const corsOrigin = process.env.CORS_ORIGIN || 'http://localhost:3000';
  const allowedOrigins = corsOrigin.split(',').map(s => s.trim());
  app.enableCors({
    origin(origin: any, callback: any) {
      if (!origin) return callback(null, true);
      const originHost = origin.replace(/^https?:\/\//, '').replace(/:\d+$/, '');
      
      // Allow local network and localhost in development
      if (originHost === 'localhost' || originHost === '127.0.0.1' || originHost.startsWith('192.168.')) {
        return callback(null, true);
      }

      if (originHost === 'rwshop.org' || originHost.endsWith('.rwshop.org')) {
        return callback(null, true);
      }
      for (const allowed of allowedOrigins) {
        const allowedHost = allowed.replace(/^https?:\/\//, '').replace(/:\d+$/, '');
        if (originHost === allowedHost || originHost.endsWith('.' + allowedHost)) {
          return callback(null, true);
        }
      }
      callback(new Error(`Origin "${origin}" not allowed by CORS.`));
    },
    credentials: true,
  });

  app.setGlobalPrefix('api/v1');
  await app.listen(process.env.PORT || 3003, '0.0.0.0');
  console.log(`Product Service is running on port ${process.env.PORT || 3003}`);
}
bootstrap();

