import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types';
import * as crypto from 'crypto';
import { AppModule } from './../src/app.module';

describe('Payment Callback Webhook HMAC Verification (e2e)', () => {
  let app: INestApplication<App>;
  const webhookSecret = 'test-webhook-secret-key';
  const internalSecret = 'test-internal-service-secret';

  beforeAll(async () => {
    process.env.PAYMENT_WEBHOOK_SECRET = webhookSecret;
    process.env.INTERNAL_SERVICE_SECRET = internalSecret;

    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  it('should block callbacks without signature or internal secret (401 Unauthorized)', async () => {
    const payload = {
      orderNumber: 'ORD-12345',
      status: 'PAID',
      transactionRef: 'TXN-99999',
    };

    const response = await request(app.getHttpServer())
      .post('/payment/callback')
      .send(payload);

    expect(response.status).toBe(401);
    expect(response.body.message).toContain('Missing signature headers');
  });

  it('should block callbacks with invalid HMAC signature (401 Unauthorized)', async () => {
    const payload = {
      orderNumber: 'ORD-12345',
      status: 'PAID',
      transactionRef: 'TXN-99999',
    };

    const response = await request(app.getHttpServer())
      .post('/payment/callback')
      .set('x-mtn-signature', 'invalid-hmac-signature-here')
      .send(payload);

    expect(response.status).toBe(401);
    expect(response.body.message).toContain('Invalid payment webhook signature');
  });

  it('should bypass signature verification if valid internal secret is supplied', async () => {
    const payload = {
      orderNumber: 'ORD-12345',
      status: 'PAID',
      transactionRef: 'TXN-99999',
    };

    const response = await request(app.getHttpServer())
      .post('/payment/callback')
      .set('x-internal-secret', internalSecret)
      .send(payload);

    // Should pass signature validation and proceed to order lookup (which returns 404 since it is a dummy order)
    expect(response.status).toBe(404);
  });

  it('should accept MTN MoMo webhook with valid HMAC-SHA256 signature in X-MTN-Signature', async () => {
    const payload = {
      orderNumber: 'ORD-12345',
      status: 'PAID',
      transactionRef: 'TXN-99999',
    };

    const rawBody = JSON.stringify(payload);
    const validSignature = crypto
      .createHmac('sha256', webhookSecret)
      .update(rawBody)
      .digest('hex');

    const response = await request(app.getHttpServer())
      .post('/payment/callback')
      .set('x-mtn-signature', validSignature)
      .send(payload);

    // Should pass signature validation and proceed to order lookup (which returns 404 since it is a dummy order)
    expect(response.status).toBe(404);
  });

  it('should accept Airtel Money webhook with valid HMAC-SHA256 signature in X-Airtel-Signature', async () => {
    const payload = {
      orderNumber: 'ORD-54321',
      status: 'FAILED',
      transactionRef: 'TXN-00000',
    };

    const rawBody = JSON.stringify(payload);
    const validSignature = crypto
      .createHmac('sha256', webhookSecret)
      .update(rawBody)
      .digest('hex');

    const response = await request(app.getHttpServer())
      .post('/payment/callback')
      .set('x-airtel-signature', validSignature)
      .send(payload);

    // Should pass signature validation and proceed to order lookup (which returns 404 since it is a dummy order)
    expect(response.status).toBe(404);
  });
});
