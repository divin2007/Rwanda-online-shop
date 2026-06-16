import { existsSync, readFileSync, mkdirSync } from 'fs';
import { resolve, join } from 'path';

// Pure-Node Bulletproof Env Loader to bypass Turbo env filtering
function loadEnvFile(filePath: string) {
  if (existsSync(filePath)) {
    console.log(`[ENV_LOADER] Loading environment variables from: ${filePath}`);
    const content = readFileSync(filePath, 'utf-8');
    content.split(/\r?\n/).forEach(line => {
      line = line.trim();
      if (!line || line.startsWith('#')) return;
      const eqIdx = line.indexOf('=');
      if (eqIdx === -1) return;
      const key = line.slice(0, eqIdx).trim();
      let val = line.slice(eqIdx + 1).trim();
      if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
        val = val.slice(1, -1);
      }
      if (process.env[key] === undefined || process.env[key] === '') {
        process.env[key] = val;
      } else {
        // Allow overriding with .env.local values
        if (filePath.endsWith('.env.local')) {
          process.env[key] = val;
        }
      }
    });
  }
}

// Find workspace root by searching upwards for package.json & .env
let searchDir = process.cwd();
for (let i = 0; i < 5; i++) {
  if (existsSync(join(searchDir, 'package.json')) && existsSync(join(searchDir, '.env'))) {
    loadEnvFile(join(searchDir, '.env'));
    loadEnvFile(join(searchDir, '.env.local'));
    break;
  }
  searchDir = join(searchDir, '..');
}

import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { json, static as serveStatic, urlencoded } from 'express';

async function bootstrap() {
  console.log('--- INITIALIZING RMF MARKET SERVICE ---');
  const app = await NestFactory.create(AppModule);

  app.use(json({ limit: '100mb' }));
  app.use(urlencoded({ limit: '100mb', extended: true }));
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
      // Reject unknown origins: reflecting arbitrary origins with credentials enabled
      // would let any website make authenticated requests against the API.
      console.warn(`[CORS] Blocked request from non-whitelisted origin: ${origin}`);
      callback(null, false);
    },
    credentials: true,
  });

  app.setGlobalPrefix('api/v1');
  const port = (process.env.PORT && process.env.PORT !== '3000') ? process.env.PORT : 3002;
  await app.listen(port, '0.0.0.0');
  console.log(`Market Service is running on port ${port}`);
}
bootstrap();
