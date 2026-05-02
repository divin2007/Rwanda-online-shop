import { Injectable, NestMiddleware } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { Logger } from './logger';

@Injectable()
export class TraceMiddleware implements NestMiddleware {
  private logger = new Logger('HttpTraffic');

  use(req: Request, res: Response, next: NextFunction) {
    const traceId = (req.headers['x-trace-id'] as string) || uuidv4();
    (req as any)['traceId'] = traceId;
    
    // Set for downstream services
    res.setHeader('X-Trace-Id', traceId);

    const start = Date.now();
    
    res.on('finish', () => {
      const duration = Date.now() - start;
      
      this.logger.info(`HTTP ${req.method} ${req.originalUrl}`, traceId, {
        method: req.method,
        url: req.originalUrl,
        status: res.statusCode,
        durationMs: duration,
        ip: req.ip,
        userAgent: req.get('user-agent')
      });
    });

    next();
  }
}
