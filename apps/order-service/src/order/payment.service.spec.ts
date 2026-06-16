import * as crypto from 'crypto';
import { PaymentService } from './payment.service';

describe('PaymentService Paypack webhook verification', () => {
  const secret = 'test-paypack-webhook-secret';
  let service: PaymentService;

  beforeEach(() => {
    process.env.PAYPACK_WEBHOOK_SECRET = secret;
    process.env.NODE_ENV = 'production';
    service = new PaymentService();
  });

  afterEach(() => {
    delete process.env.PAYPACK_WEBHOOK_SECRET;
    delete process.env.NODE_ENV;
    delete process.env.PAYPACK_CLIENT_ID;
    delete process.env.PAYPACK_CLIENT_SECRET;
    delete process.env.PAYPACK_PLATFORM_PHONE;
  });

  it('accepts the Paypack x-paypack-signature HMAC over the raw body', () => {
    const body = { data: { ref: 'abc123', status: 'successful' } };
    const rawBody = Buffer.from(JSON.stringify(body));
    const signature = crypto.createHmac('sha256', secret).update(rawBody).digest('base64');

    expect(service.verifyPaypackWebhook(body, { 'x-paypack-signature': signature }, rawBody)).toBe(true);
  });

  it('accepts sha256-prefixed hexadecimal signatures too', () => {
    const body = { data: { ref: 'abc123', status: 'successful' } };
    const rawBody = Buffer.from(JSON.stringify(body));
    const signature = crypto.createHmac('sha256', secret).update(rawBody).digest('hex');

    expect(service.verifyPaypackWebhook(body, { 'x-paypack-signature': `sha256=${signature}` }, rawBody)).toBe(true);
  });

  it('rejects missing signatures in production', () => {
    expect(service.verifyPaypackWebhook({ ref: 'abc123' }, {}, Buffer.from('{}'))).toBe(false);
  });

  it('reports production readiness without exposing secret values', () => {
    process.env.PAYPACK_CLIENT_ID = 'client-id';
    process.env.PAYPACK_CLIENT_SECRET = 'client-secret';
    process.env.PAYPACK_PLATFORM_PHONE = '0780000000';
    service = new PaymentService();

    expect(service.getPaypackReadiness()).toMatchObject({
      cashinConfigured: true,
      webhookConfigured: true,
      settlementConfigured: true,
      productionSafe: true,
      missing: [],
      webhookPath: '/api/v1/orders/payment/paypack/callback',
    });
  });
});
