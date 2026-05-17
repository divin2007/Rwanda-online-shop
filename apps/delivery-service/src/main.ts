import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { json, static as serveStatic, urlencoded } from 'express';
import { existsSync, mkdirSync } from 'fs';
import { join } from 'path';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  app.use(json({ limit: '50mb' }));
  app.use(urlencoded({ extended: true, limit: '50mb' }));
  const uploadRoot = join(process.cwd(), 'uploads');
  if (!existsSync(uploadRoot)) mkdirSync(uploadRoot, { recursive: true });
  app.use('/uploads', serveStatic(uploadRoot));

    const corsOrigin = process.env.CORS_ORIGIN || 'http://localhost:3000,https://rwshop.org,https://www.rwshop.org';
  const allowedOrigins = corsOrigin.split(',').map(s => s.trim());
  app.enableCors({
    origin: (origin: any, callback: any) => callback(null, true),
    credentials: true,
  });

  app.setGlobalPrefix('api/v1');
  await app.listen(process.env.PORT || 3008, '0.0.0.0');
  console.log(`Delivery Service is running on port ${process.env.PORT || 3008}`);
}
bootstrap();

