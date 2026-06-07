import axios from 'axios';
import { PaymentService, normalizeMomoPhone } from './payment.service';

jest.mock('uuid', () => ({ v4: () => '00000000-0000-4000-8000-000000000000' }));
jest.mock('axios');

const mockedAxios = axios as jest.Mocked<typeof axios>;

const MTN_ENV_KEYS = [
  'MTN_MOMO_COLLECTION_API_KEY',
  'MTN_MOMO_COLLECTION_USER_ID',
  'MTN_MOMO_COLLECTION_API_SECRET',
  'MTN_MOMO_DISBURSEMENT_API_KEY',
  'MTN_MOMO_DISBURSEMENT_USER_ID',
  'MTN_MOMO_DISBURSEMENT_API_SECRET',
  'MTN_MOMO_TARGET_ENV',
  'MTN_MOMO_BASE_URL',
  'MTN_MOMO_CALLBACK_URL',
  'NODE_ENV',
  'AUTO_CONFIRM_PAYMENTS',
];

function setFullMtnConfig() {
  process.env.MTN_MOMO_COLLECTION_API_KEY = 'col-key';
  process.env.MTN_MOMO_COLLECTION_USER_ID = 'col-user';
  process.env.MTN_MOMO_COLLECTION_API_SECRET = 'col-secret';
  process.env.MTN_MOMO_DISBURSEMENT_API_KEY = 'dis-key';
  process.env.MTN_MOMO_DISBURSEMENT_USER_ID = 'dis-user';
  process.env.MTN_MOMO_DISBURSEMENT_API_SECRET = 'dis-secret';
  process.env.MTN_MOMO_BASE_URL = 'https://sandbox.example.mtn';
}

describe('PaymentService (MTN MoMo)', () => {
  afterEach(() => {
    jest.clearAllMocks();
    for (const key of MTN_ENV_KEYS) delete process.env[key];
  });

  describe('normalizeMomoPhone', () => {
    it('normalizes 07XXXXXXXX to 2507XXXXXXXX', () => {
      expect(normalizeMomoPhone('0788123456')).toBe('250788123456');
    });
    it('passes through 2507XXXXXXXX', () => {
      expect(normalizeMomoPhone('250788123456')).toBe('250788123456');
    });
    it('normalizes +2507XXXXXXXX', () => {
      expect(normalizeMomoPhone('+250788123456')).toBe('250788123456');
    });
    it('normalizes bare 7XXXXXXXX', () => {
      expect(normalizeMomoPhone('788123456')).toBe('250788123456');
    });
    it('throws on an invalid number', () => {
      expect(() => normalizeMomoPhone('12345')).toThrow('Invalid Rwanda phone number');
    });
  });

  describe('getMtnReadiness', () => {
    it('reports all configured when the 6 credentials are present', () => {
      setFullMtnConfig();
      process.env.MTN_MOMO_CALLBACK_URL = 'https://cb.example/mtn';
      const service = new PaymentService();
      expect(service.getMtnReadiness()).toMatchObject({
        collectionConfigured: true,
        disbursementConfigured: true,
        callbackConfigured: true,
        missing: [],
        callbackPath: '/api/v1/orders/payment/mtn/callback',
      });
    });

    it('lists missing credentials', () => {
      process.env.MTN_MOMO_COLLECTION_API_KEY = 'col-key';
      const service = new PaymentService();
      const readiness = service.getMtnReadiness();
      expect(readiness.collectionConfigured).toBe(false);
      expect(readiness.disbursementConfigured).toBe(false);
      expect(readiness.missing).toContain('MTN_MOMO_DISBURSEMENT_API_KEY');
      expect(readiness.missing).toContain('MTN_MOMO_COLLECTION_USER_ID');
    });
  });

  describe('requestPaymentPrompt', () => {
    it('auto-confirms in sandbox without calling the gateway', async () => {
      process.env.NODE_ENV = 'development';
      process.env.MTN_MOMO_TARGET_ENV = 'sandbox';
      const service = new PaymentService();
      const result = await service.requestPaymentPrompt({ orderNumber: 'ORD-1', financials: { totalAmount: 5000 }, buyer: { phone: '0788123456' } });
      expect(result.success).toBe(true);
      expect(result.transactionId).toMatch(/^DEV-AUTO-REF-/);
      expect(mockedAxios.post).not.toHaveBeenCalled();
    });

    it('initiates a real request-to-pay and returns the reference id', async () => {
      setFullMtnConfig();
      process.env.NODE_ENV = 'production';
      mockedAxios.post
        .mockResolvedValueOnce({ data: { access_token: 'tok', expires_in: 3600 } } as any) // token
        .mockResolvedValueOnce({ status: 202, data: '' } as any); // requesttopay
      const service = new PaymentService();
      const result = await service.requestPaymentPrompt({ orderNumber: 'ORD-2', financials: { totalAmount: 5000 }, buyer: { phone: '0788123456' } });
      expect(result.success).toBe(true);
      expect(result.transactionId).toBe('00000000-0000-4000-8000-000000000000');
      const payCall = mockedAxios.post.mock.calls[1];
      expect(payCall[0]).toContain('/collection/v1_0/requesttopay');
      expect(payCall[1]).toMatchObject({ amount: '5000', currency: 'RWF', payer: { partyId: '250788123456' } });
    });

    it('rejects an invalid phone before calling the gateway', async () => {
      setFullMtnConfig();
      process.env.NODE_ENV = 'production';
      const service = new PaymentService();
      const result = await service.requestPaymentPrompt({ orderNumber: 'ORD-3', financials: { totalAmount: 5000 }, buyer: { phone: '123' } });
      expect(result.success).toBe(false);
      expect(mockedAxios.post).not.toHaveBeenCalled();
    });
  });

  describe('parseMtnCallback', () => {
    it('parses a SUCCESSFUL callback', () => {
      const service = new PaymentService();
      const parsed = service.parseMtnCallback({ referenceId: 'ref-1', status: 'SUCCESSFUL', externalId: 'ORD-9', financialTransactionId: 'fin-1' });
      expect(parsed).toMatchObject({ transactionRef: 'ref-1', status: 'SUCCESSFUL', orderNumber: 'ORD-9', financialTransactionId: 'fin-1' });
    });
    it('maps FAILED', () => {
      const service = new PaymentService();
      expect(service.parseMtnCallback({ referenceId: 'ref-2', status: 'FAILED' }).status).toBe('FAILED');
    });
    it('maps unknown/pending to PENDING', () => {
      const service = new PaymentService();
      expect(service.parseMtnCallback({ referenceId: 'ref-3', status: 'PENDING' }).status).toBe('PENDING');
    });
    it('throws when referenceId is missing', () => {
      const service = new PaymentService();
      expect(() => service.parseMtnCallback({ status: 'SUCCESSFUL' })).toThrow('missing referenceId');
    });
  });

  describe('requestMtnDisbursement', () => {
    it('posts a transfer and returns the reference id on 202', async () => {
      setFullMtnConfig();
      mockedAxios.post
        .mockResolvedValueOnce({ data: { access_token: 'tok', expires_in: 3600 } } as any) // token
        .mockResolvedValueOnce({ status: 202, data: '' } as any); // transfer
      const service = new PaymentService();
      const result = await service.requestMtnDisbursement(2000, '0788123456', 'withdraw-1');
      expect(result.success).toBe(true);
      expect(typeof result.transactionId).toBe('string');
      const transferCall = mockedAxios.post.mock.calls[1];
      expect(transferCall[0]).toContain('/disbursement/v1_0/transfer');
      expect(transferCall[1]).toMatchObject({ amount: '2000', currency: 'RWF', payee: { partyId: '250788123456' } });
    });

    it('rejects a non-positive amount without calling the gateway', async () => {
      setFullMtnConfig();
      const service = new PaymentService();
      const result = await service.requestMtnDisbursement(0, '0788123456', 'withdraw-2');
      expect(result.success).toBe(false);
      expect(mockedAxios.post).not.toHaveBeenCalled();
    });
  });
});
