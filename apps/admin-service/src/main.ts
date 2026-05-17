import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { json, urlencoded } from 'express';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  
  app.use(json({ limit: '100mb' }));
  app.use(urlencoded({ limit: '100mb', extended: true }));

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
  await app.listen(process.env.PORT || 3011, '0.0.0.0');
  console.log(`Admin Service is running on port ${process.env.PORT || 3011}`);
}
bootstrap();

