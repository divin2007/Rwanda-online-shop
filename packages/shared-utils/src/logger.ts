export class Logger {
  private service: string;

  constructor(service: string) {
    this.service = service;
  }

  private formatMessage(level: string, message: string, traceId?: string, meta?: any) {
    return JSON.stringify({
      timestamp: new Date().toISOString(),
      level,
      service: this.service,
      traceId: traceId || 'no-trace',
      message,
      ...(meta && { meta })
    });
  }

  info(message: string, traceId?: string, meta?: any) {
    console.log(this.formatMessage('INFO', message, traceId, meta));
  }

  warn(message: string, traceId?: string, meta?: any) {
    console.warn(this.formatMessage('WARN', message, traceId, meta));
  }

  error(message: string, traceId?: string, error?: any, meta?: any) {
    console.error(this.formatMessage('ERROR', message, traceId, { ...meta, error: error?.message || error }));
  }

  debug(message: string, traceId?: string, meta?: any) {
    if (process.env.NODE_ENV !== 'production') {
      console.debug(this.formatMessage('DEBUG', message, traceId, meta));
    }
  }
}
