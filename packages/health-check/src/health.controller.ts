import { Controller, Get, SetMetadata } from '@nestjs/common';
import { HealthCheck, HealthCheckService, HealthIndicatorResult, MongooseHealthIndicator } from '@nestjs/terminus';
import { Socket } from 'net';

@Controller('health')
@SetMetadata('isPublic', true)
export class HealthController {
  constructor(
    private health: HealthCheckService,
    private mongoose: MongooseHealthIndicator,
  ) {}

  @Get()
  @HealthCheck()
  check() {
    return this.health.check([
      () => this.mongoose.pingCheck('mongodb'),
      () => this.redisCheck(),
    ]);
  }

  private async redisCheck(): Promise<HealthIndicatorResult> {
    const redisUrl = process.env.REDIS_URL;
    if (!redisUrl) {
      return { redis: { status: 'up', skipped: true } };
    }

    return new Promise((resolve, reject) => {
      const parsed = new URL(redisUrl);
      const socket = new Socket();
      const timeoutMs = Number(process.env.HEALTH_REDIS_TIMEOUT_MS || 1000);
      const port = Number(parsed.port || 6379);

      const cleanup = () => {
        socket.removeAllListeners();
        socket.destroy();
      };

      socket.setTimeout(timeoutMs);
      socket.once('connect', () => {
        cleanup();
        resolve({ redis: { status: 'up' } });
      });
      socket.once('timeout', () => {
        cleanup();
        reject(new Error('Redis health check timed out'));
      });
      socket.once('error', (error) => {
        cleanup();
        reject(error);
      });
      socket.connect(port, parsed.hostname);
    });
  }
}
