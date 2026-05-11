import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { json, urlencoded } from 'express';

async function bootstrap() {
  console.log('--- INITIALIZING RMF MARKET SERVICE ---');
  const app = await NestFactory.create(AppModule);

  app.use(json({ limit: '100mb' }));
  app.use(urlencoded({ limit: '100mb', extended: true }));

    const corsOrigin = process.env.CORS_ORIGIN || 'http://localhost:3000,https://rwshop.org,https://www.rwshop.org';
  const allowedOrigins = corsOrigin.split(',').map(s => s.trim());
  app.enableCors({
    origin(origin: any, callback: any) {
      if (!origin) return callback(null, true);
      const originHost = origin.replace(/^https?:\/\//, '').replace(/:\d+$/, '');
      if (originHost === 'rwshop.org' || originHost.endsWith('.rwshop.org')) {
        return callback(null, true);
      }
      for (const allowed of allowedOrigins) {
        const allowedHost = allowed.replace(/^https?:\/\//, '').replace(/:\d+$/, '');
        if (originHost === allowedHost || originHost.endsWith('.' + allowedHost)) {
          return callback(null, true);
        }
      }
      callback(new Error(`Origin "${origin}" not allowed by CORS. Set CORS_ORIGIN env var to include it.`));
    },
    credentials: true,
  });

  app.setGlobalPrefix('api/v1');
  const port = process.env.PORT || 3002;
  await app.listen(port, '0.0.0.0');
  console.log(`Market Service is running on port ${port}`);
}
bootstrap();
