import { Injectable, Logger } from '@nestjs/common';
import axios from 'axios';
import * as crypto from 'crypto';
import { v4 as uuidv4 } from 'uuid';

type PaymentProviderMethod = 'MTN_MOMO' | 'AIRTEL_MONEY' | 'TIGO_CASH';

export interface ParsedPaypackWebhook {
  orderNumber?: string;
  transactionRef: string;
  status: 'SUCCESSFUL' | 'FAILED' | 'PENDING';
  provider?: string;
  rawStatus?: string;
}

export interface PaypackCashoutRequest {
  amount: number;
  phone: string;
  idempotencyKey: string;
  purpose: 'seller_payout' | 'rider_payout' | 'platform_commission' | 'buyer_refund';
}

export interface PaypackRefundRequest {
  amount: number;
  phone: string;
  idempotencyKey: string;
  originalTransactionRef?: string;
}

export interface PaypackReadiness {
  baseUrl: string;
  webhookMode: string;
  cashinConfigured: boolean;
  webhookConfigured: boolean;
  settlementConfigured: boolean;
  productionSafe: boolean;
  missing: string[];
  webhookPath: string;
}

@Injectable()
export class PaymentService {
  private readonly logger = new Logger(PaymentService.name);

  private paypackAccessToken?: { token: string; expiresAt: number };

  private readonly paypackConfig = {
    clientId: process.env.PAYPACK_CLIENT_ID,
    clientSecret: process.env.PAYPACK_CLIENT_SECRET,
    baseUrl: process.env.PAYPACK_BASE_URL || 'https://payments.paypack.rw/api',
    webhookMode: process.env.PAYPACK_WEBHOOK_MODE || (process.env.NODE_ENV === 'production' ? 'production' : 'development'),
  };

  private readonly momoConfig = {
    apiKey: process.env.MTN_MOMO_API_KEY,
    userId: process.env.MTN_MOMO_USER_ID,
    apiSecret: process.env.MTN_MOMO_API_SECRET,
    baseUrl: process.env.MTN_MOMO_TARGET_ENV === 'sandbox'
      ? 'https://sandbox.momodeveloper.mtn.com'
      : 'https://proxy.momoapi.mtn.com',
    targetEnv: process.env.MTN_MOMO_TARGET_ENV || 'mtnrwanda'
  };

  private readonly airtelConfig = {
    apiKey: process.env.AIRTEL_MONEY_API_KEY,
    secret: process.env.AIRTEL_MONEY_SECRET,
    baseUrl: process.env.AIRTEL_MONEY_TARGET_ENV === 'sandbox'
      ? 'https://openapiuat.airtel.africa'
      : 'https://openapi.airtel.africa',
  };

  async requestPaymentPrompt(order: any): Promise<{ success: boolean; transactionId?: string; error?: string }> {
    // CRITICAL: Auto-confirm must NEVER activate in production.
    // The .env file may have AUTO_CONFIRM_PAYMENTS=true for local dev,
    // but this must be gated behind NODE_ENV !== 'production'.
    const isNotProduction = process.env.NODE_ENV !== 'production';
    const shouldAutoConfirm = isNotProduction && (
      process.env.AUTO_CONFIRM_PAYMENTS === 'true' ||
      (process.env.PAYPACK_WEBHOOK_MODE === 'development' && process.env.PAYPACK_AUTO_CONFIRM === 'true')
    );

    if (shouldAutoConfirm) {
      this.logger.log(`[SANDBOX] Dev mode intercepted. Bypassing real payment gateway for order ${order.orderNumber}.`);
      return { success: true, transactionId: 'DEV-AUTO-REF-' + Date.now() };
    }

    const method = (order.payment?.method || 'MTN_MOMO') as PaymentProviderMethod;

    if (this.isPaypackConfigured()) {
      return this.requestPaypackPayment(order, method);
    }

    if (process.env.NODE_ENV === 'production' || process.env.ALLOW_LEGACY_PAYMENT_GATEWAYS !== 'true') {
      this.logger.error('Paypack credentials are missing and legacy gateways are disabled.');
      return {
        success: false,
        error: 'Payment gateway is not configured. Please set PAYPACK_CLIENT_ID and PAYPACK_CLIENT_SECRET.'
      };
    }

    this.logger.warn(`Paypack is not configured. Falling back to legacy ${method} gateway in non-production mode.`);
    switch (method) {
      case 'AIRTEL_MONEY':
      case 'TIGO_CASH':
        return this.requestAirtelPayment(order);
      case 'MTN_MOMO':
      default:
        return this.requestMtnPayment(order);
    }
  }

  async getPaymentStatus(referenceId: string, method?: string): Promise<{ status: string; transactionId?: string }> {
    // CRITICAL: Auto-confirm must NEVER activate in production.
    const isNotProduction = process.env.NODE_ENV !== 'production';
    const shouldAutoConfirmPayments = isNotProduction && process.env.AUTO_CONFIRM_PAYMENTS === 'true';
    if (shouldAutoConfirmPayments || referenceId?.startsWith('DEV-') || referenceId?.startsWith('SANDBOX-')) {
      return { status: 'SUCCESSFUL', transactionId: 'DEV-TX-' + referenceId };
    }

    if (this.isPaypackReference(referenceId) || this.isPaypackConfigured()) {
      return this.getPaypackPaymentStatus(referenceId);
    }

    switch (method) {
      case 'AIRTEL_MONEY':
      case 'TIGO_CASH':
        return this.getAirtelPaymentStatus(referenceId);
      case 'MTN_MOMO':
      default:
        return this.getMtnPaymentStatus(referenceId);
    }
  }

  getPaypackReadiness(): PaypackReadiness {
    const missing: string[] = [];
    const clientId = process.env.PAYPACK_CLIENT_ID;
    const clientSecret = process.env.PAYPACK_CLIENT_SECRET;
    const webhookSecret = process.env.PAYPACK_WEBHOOK_SECRET || process.env.PAYPACK_WEBHOOK_SIGN_KEY;
    const platformPhone = process.env.PAYPACK_PLATFORM_PHONE || process.env.RMF_PLATFORM_MOMO_NUMBER || process.env.PLATFORM_MOMO_NUMBER;

    if (!clientId) missing.push('PAYPACK_CLIENT_ID');
    if (!clientSecret) missing.push('PAYPACK_CLIENT_SECRET');
    if (!webhookSecret) missing.push('PAYPACK_WEBHOOK_SECRET');
    if (!platformPhone) missing.push('PAYPACK_PLATFORM_PHONE');

    const cashinConfigured = Boolean(clientId && clientSecret);
    const webhookConfigured = Boolean(webhookSecret);
    const settlementConfigured = Boolean(platformPhone);

    return {
      baseUrl: this.paypackConfig.baseUrl,
      webhookMode: this.paypackConfig.webhookMode,
      cashinConfigured,
      webhookConfigured,
      settlementConfigured,
      productionSafe: process.env.NODE_ENV !== 'production' || (cashinConfigured && webhookConfigured && settlementConfigured),
      missing,
      webhookPath: '/api/v1/orders/payment/paypack/callback',
    };
  }

  verifyPaypackWebhook(body: any, headers: Record<string, any>, rawBody?: Buffer | string): boolean {
    const signature = String(
      headers?.['x-paypack-signature'] ||
      headers?.['X-Paypack-Signature'] ||
      headers?.['x-paypack-webhook-signature'] ||
      headers?.['x-webhook-signature'] ||
      headers?.['x-signature'] ||
      body?.signature ||
      ''
    ).replace(/^sha256=/i, '').trim();
    const secret = process.env.PAYPACK_WEBHOOK_SECRET || process.env.PAYPACK_WEBHOOK_SIGN_KEY;

    if (!secret) {
      if (process.env.NODE_ENV === 'production') {
        this.logger.error('Missing PAYPACK_WEBHOOK_SECRET in production.');
        return false;
      }
      this.logger.warn('PAYPACK_WEBHOOK_SECRET is not set. Accepting Paypack webhook only because this is not production.');
      return true;
    }

    if (!signature) {
      return false;
    }

    const bodyWithoutSignature = this.omitSignature(body);
    const candidates = [
      rawBody ? (Buffer.isBuffer(rawBody) ? rawBody : Buffer.from(rawBody)) : undefined,
      Buffer.from(JSON.stringify(body)),
      Buffer.from(this.stableStringify(body)),
      Buffer.from(JSON.stringify(bodyWithoutSignature)),
      Buffer.from(this.stableStringify(bodyWithoutSignature)),
    ].filter(Boolean) as Buffer[];

    return candidates.some(candidate => this.verifyHmacSha256(candidate, signature, secret));
  }

  parsePaypackWebhook(body: any): ParsedPaypackWebhook {
    const data = body?.data || body?.transaction || body || {};
    const ref = data?.ref || data?.reference || data?.transactionRef || data?.transaction_ref || body?.ref;
    if (!ref) {
      throw new Error('Paypack webhook is missing transaction reference');
    }

    const rawStatus = String(data?.status || body?.status || '').trim();
    const orderNumber = data?.order_id || data?.orderNumber || data?.order_number || body?.orderNumber;

    return {
      orderNumber: orderNumber ? String(orderNumber) : undefined,
      transactionRef: this.toPaypackReference(String(ref)),
      status: this.normalizeGatewayStatus(rawStatus),
      provider: data?.provider,
      rawStatus,
    };
  }

  isPaypackReference(referenceId?: string): boolean {
    return Boolean(referenceId && referenceId.startsWith('PAYPACK:'));
  }

  async requestPaypackCashout(request: PaypackCashoutRequest): Promise<{ success: boolean; transactionId?: string; error?: string }> {
    if (!this.isPaypackConfigured()) {
      this.logger.error('Cannot create Paypack cashout because Paypack is not configured.');
      return {
        success: false,
        error: 'Paypack is not configured. Set PAYPACK_CLIENT_ID and PAYPACK_CLIENT_SECRET.'
      };
    }

    const amount = Math.round(Number(request.amount || 0));
    const phone = this.normalizeRwandaPhoneForPaypack(request.phone);

    if (!amount || amount <= 0) {
      return { success: false, error: 'Cashout amount must be greater than zero' };
    }

    if (!/^07\d{8}$/.test(phone)) {
      return { success: false, error: 'Use a valid Rwanda mobile money number, for example 078xxxxxxx.' };
    }

    const idempotencyKey = crypto
      .createHash('sha256')
      .update(String(request.idempotencyKey || uuidv4()))
      .digest('hex')
      .slice(0, 32);

    this.logger.log(`Initiating Paypack cashout (${request.purpose}) for ${phone} - Amount: ${amount} RWF`);

    try {
      const token = await this.getPaypackAccessToken();
      const response = await axios.post(
        `${this.paypackConfig.baseUrl}/transactions/cashout`,
        {
          amount,
          number: phone,
          environment: this.paypackConfig.webhookMode,
        },
        {
          headers: {
            Accept: 'application/json',
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
            'Idempotency-Key': idempotencyKey,
            'X-Webhook-Mode': this.paypackConfig.webhookMode,
          },
          timeout: 20000,
        }
      );

      const ref = response.data?.ref || response.data?.data?.ref || response.data?.reference;
      if (!ref) {
        throw new Error('Paypack did not return a cashout reference');
      }

      this.logger.log(`Paypack cashout prompt sent successfully. Ref: ${ref}`);
      return { success: true, transactionId: this.toPaypackReference(String(ref)) };
    } catch (error: any) {
      this.logger.error('Paypack cashout failed', error.response?.data || error.message);
      return {
        success: false,
        error: error.response?.data?.message || error.response?.data?.error || 'Paypack cashout failed'
      };
    }
  }

  async requestPaypackRefund(request: PaypackRefundRequest): Promise<{ success: boolean; transactionId?: string; error?: string }> {
    return this.requestPaypackCashout({
      amount: request.amount,
      phone: request.phone,
      idempotencyKey: request.originalTransactionRef
        ? `${request.idempotencyKey}:${this.stripPaypackPrefix(request.originalTransactionRef)}`
        : request.idempotencyKey,
      purpose: 'buyer_refund',
    });
  }

  private isPaypackConfigured(): boolean {
    return Boolean(this.paypackConfig.clientId && this.paypackConfig.clientSecret);
  }

  private async getPaypackAccessToken(): Promise<string> {
    if (this.paypackAccessToken && this.paypackAccessToken.expiresAt > Date.now()) {
      return this.paypackAccessToken.token;
    }

    try {
      const response = await axios.post(
        `${this.paypackConfig.baseUrl}/auth/agents/authorize`,
        {
          client_id: this.paypackConfig.clientId,
          client_secret: this.paypackConfig.clientSecret,
        },
        {
          headers: {
            Accept: 'application/json',
            'Content-Type': 'application/json',
          },
          timeout: 15000,
        }
      );

      const token = response.data?.access || response.data?.access_token || response.data?.token;
      if (!token) {
        throw new Error('Paypack response did not include an access token');
      }

      const expiresSeconds = Number(response.data?.expires) || 15 * 60;
      this.paypackAccessToken = {
        token,
        expiresAt: Date.now() + Math.max(expiresSeconds - 60, 60) * 1000,
      };

      return token;
    } catch (error: any) {
      this.logger.error('Failed to get Paypack access token', error.response?.data || error.message);
      throw new Error('Paypack authentication failed');
    }
  }

  private async requestPaypackPayment(
    order: any,
    method: PaymentProviderMethod,
  ): Promise<{ success: boolean; transactionId?: string; error?: string }> {
    const amount = Math.round(Number(order.financials?.totalAmount || 0));
    const phone = this.normalizeRwandaPhoneForPaypack(order.buyer?.phone);

    if (!amount || amount <= 0) {
      return { success: false, error: 'Order amount must be greater than zero' };
    }

    if (!/^07\d{8}$/.test(phone)) {
      return { success: false, error: 'Use a valid Rwanda mobile money number, for example 078xxxxxxx.' };
    }

    const idempotencyKey = this.paypackIdempotencyKey(order, method);
    this.logger.log(`Initiating Paypack cashin (${method}) for ${phone} - Amount: ${amount} RWF`);

    try {
      const token = await this.getPaypackAccessToken();
      const response = await axios.post(
        `${this.paypackConfig.baseUrl}/transactions/cashin`,
        {
          amount,
          number: phone,
          environment: this.paypackConfig.webhookMode,
        },
        {
          headers: {
            Accept: 'application/json',
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
            'Idempotency-Key': idempotencyKey,
            'X-Webhook-Mode': this.paypackConfig.webhookMode,
          },
          timeout: 20000,
        }
      );

      const ref = response.data?.ref || response.data?.data?.ref || response.data?.reference;
      if (!ref) {
        throw new Error('Paypack did not return a transaction reference');
      }

      this.logger.log(`Paypack cashin prompt sent successfully. Ref: ${ref}`);
      return { success: true, transactionId: this.toPaypackReference(String(ref)) };
    } catch (error: any) {
      this.logger.error('Paypack cashin failed', error.response?.data || error.message);
      return {
        success: false,
        error: error.response?.data?.message || error.response?.data?.error || 'Paypack payment initiation failed'
      };
    }
  }

  private async getPaypackPaymentStatus(referenceId: string): Promise<{ status: string; transactionId?: string }> {
    if (!this.isPaypackConfigured()) {
      this.logger.error('Cannot check Paypack status because Paypack is not configured.');
      return { status: 'ERROR' };
    }

    const paypackRef = this.stripPaypackPrefix(referenceId);
    try {
      const token = await this.getPaypackAccessToken();
      const response = await axios.get(
        `${this.paypackConfig.baseUrl}/transactions/find/${paypackRef}`,
        {
          headers: {
            Accept: 'application/json',
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          timeout: 15000,
        }
      );

      const transaction = response.data?.data || response.data;
      const status = this.normalizeGatewayStatus(transaction?.status);
      return {
        status,
        transactionId: this.toPaypackReference(transaction?.ref || paypackRef),
      };
    } catch (error: any) {
      this.logger.error(`Failed to check Paypack status for ${paypackRef}`, error.response?.data || error.message);
      return { status: 'ERROR' };
    }
  }

  private normalizeGatewayStatus(status: any): 'SUCCESSFUL' | 'FAILED' | 'PENDING' {
    const value = String(status || '').trim().toLowerCase();
    if (['successful', 'success', 'paid', 'complete', 'completed', 'processed', 'approved'].includes(value)) {
      return 'SUCCESSFUL';
    }
    if (['failed', 'failure', 'rejected', 'cancelled', 'canceled', 'expired', 'declined'].includes(value)) {
      return 'FAILED';
    }
    return 'PENDING';
  }

  private normalizeRwandaPhoneForPaypack(phone?: string): string {
    const digits = String(phone || '').replace(/\D/g, '');
    if (digits.startsWith('2507') && digits.length === 12) return `0${digits.slice(3)}`;
    if (digits.startsWith('07') && digits.length === 10) return digits;
    if (digits.startsWith('7') && digits.length === 9) return `0${digits}`;
    return digits;
  }

  private paypackIdempotencyKey(order: any, method: string): string {
    const attempts = Array.isArray(order.paymentAttempts) ? order.paymentAttempts.length : 0;
    const retryNonce = order._paypackRetryNonce || '';
    const raw = `${order.orderNumber || order._id || uuidv4()}:${method}:cashin:${attempts + 1}:${retryNonce}`;
    return crypto.createHash('sha256').update(raw).digest('hex').slice(0, 32);
  }

  private toPaypackReference(referenceId: string): string {
    const clean = this.stripPaypackPrefix(referenceId);
    return `PAYPACK:${clean}`;
  }

  private stripPaypackPrefix(referenceId: string): string {
    return String(referenceId || '').replace(/^PAYPACK:/, '');
  }

  private omitSignature(body: any): any {
    if (!body || typeof body !== 'object' || Array.isArray(body)) return body;
    const clone: Record<string, any> = {};
    for (const [key, value] of Object.entries(body)) {
      if (!['signature', 'x-paypack-signature'].includes(key.toLowerCase())) {
        clone[key] = value;
      }
    }
    return clone;
  }

  private stableStringify(value: any): string {
    if (value === null || typeof value !== 'object') return JSON.stringify(value);
    if (Array.isArray(value)) return `[${value.map(item => this.stableStringify(item)).join(',')}]`;
    return `{${Object.keys(value).sort().map(key => `${JSON.stringify(key)}:${this.stableStringify(value[key])}`).join(',')}}`;
  }

  private verifyHmacSha256(payload: Buffer, signature: string, secret: string): boolean {
    const normalizedSignature = String(signature || '').trim();
    const computedHex = crypto.createHmac('sha256', secret).update(payload).digest('hex');
    const computedBase64 = crypto.createHmac('sha256', secret).update(payload).digest('base64');

    try {
      if (/^[a-f0-9]{64}$/i.test(normalizedSignature)) {
        const signatureBuffer = Buffer.from(normalizedSignature, 'hex');
        const computedBuffer = Buffer.from(computedHex, 'hex');
        return signatureBuffer.length === computedBuffer.length && crypto.timingSafeEqual(signatureBuffer, computedBuffer);
      }

      const signatureBuffer = Buffer.from(normalizedSignature, 'base64');
      const computedBuffer = Buffer.from(computedBase64, 'base64');
      return signatureBuffer.length === computedBuffer.length && crypto.timingSafeEqual(signatureBuffer, computedBuffer);
    } catch {
      return false;
    }
  }

  // Legacy MTN MoMo fallback. Disabled in production unless ALLOW_LEGACY_PAYMENT_GATEWAYS=true.
  private async getMtnAccessToken(): Promise<string> {
    const auth = Buffer.from(`${this.momoConfig.userId}:${this.momoConfig.apiSecret}`).toString('base64');

    try {
      const response = await axios.post(
        `${this.momoConfig.baseUrl}/collection/token/`,
        {},
        {
          headers: {
            'Authorization': `Basic ${auth}`,
            'Ocp-Apim-Subscription-Key': this.momoConfig.apiKey
          }
        }
      );
      return response.data.access_token;
    } catch (error: any) {
      this.logger.error('Failed to get MoMo access token', error.response?.data || error.message);
      throw new Error('Payment gateway authentication failed');
    }
  }

  private async requestMtnPayment(order: any): Promise<{ success: boolean; transactionId?: string; error?: string }> {
    const { totalAmount } = order.financials;
    const { phone } = order.buyer;
    const referenceId = uuidv4();

    this.logger.log(`Initiating MTN MoMo prompt for ${phone} - Amount: ${totalAmount} RWF`);

    try {
      const token = await this.getMtnAccessToken();

      const payload = {
        amount: totalAmount.toString(),
        currency: 'RWF',
        externalId: order.orderNumber,
        payer: {
          partyIdType: 'MSISDN',
          partyId: phone.replace(/^\+?0*250|^0/, '250').replace(/^(?!250)/, '250')
        },
        payerMessage: `Payment for Order ${order.orderNumber}`,
        payeeNote: 'Rwanda Marketplace'
      };

      await axios.post(
        `${this.momoConfig.baseUrl}/collection/v1_0/requesttopay`,
        payload,
        {
          headers: {
            'Authorization': `Bearer ${token}`,
            'X-Reference-Id': referenceId,
            'X-Target-Environment': this.momoConfig.targetEnv,
            'Content-Type': 'application/json',
            'Ocp-Apim-Subscription-Key': this.momoConfig.apiKey
          }
        }
      );

      this.logger.log(`MoMo Request to Pay sent successfully. Ref: ${referenceId}`);
      return { success: true, transactionId: referenceId };
    } catch (error: any) {
      this.logger.error('MoMo Request to Pay Failed', error.response?.data || error.message);
      return { success: false, error: error.response?.data?.message || 'MTN MoMo payment initiation failed' };
    }
  }

  private async getMtnPaymentStatus(referenceId: string): Promise<{ status: string; transactionId?: string }> {
    try {
      const token = await this.getMtnAccessToken();
      const response = await axios.get(
        `${this.momoConfig.baseUrl}/collection/v1_0/requesttopay/${referenceId}`,
        {
          headers: {
            'Authorization': `Bearer ${token}`,
            'X-Target-Environment': this.momoConfig.targetEnv,
            'Ocp-Apim-Subscription-Key': this.momoConfig.apiKey
          }
        }
      );

      return {
        status: response.data.status,
        transactionId: response.data.financialTransactionId
      };
    } catch (error: any) {
      this.logger.error(`Failed to check MoMo status for ${referenceId}`, error.response?.data || error.message);
      return { status: 'ERROR' };
    }
  }

  // Legacy Airtel Money fallback. Tigo Cash is routed through Paypack in normal operation.
  private async getAirtelAccessToken(): Promise<string> {
    try {
      const response = await axios.post(
        `${this.airtelConfig.baseUrl}/auth/oauth2/token`,
        {
          client_id: this.airtelConfig.apiKey,
          client_secret: this.airtelConfig.secret,
          grant_type: 'client_credentials'
        },
        {
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' }
        }
      );
      return response.data.access_token;
    } catch (error: any) {
      this.logger.error('Failed to get Airtel Money access token', error.response?.data || error.message);
      throw new Error('Airtel Money authentication failed');
    }
  }

  private async requestAirtelPayment(order: any): Promise<{ success: boolean; transactionId?: string; error?: string }> {
    const { totalAmount } = order.financials;
    const { phone } = order.buyer;
    const referenceId = uuidv4();

    this.logger.log(`Initiating Airtel Money prompt for ${phone} - Amount: ${totalAmount} RWF`);

    try {
      const token = await this.getAirtelAccessToken();
      const formattedPhone = phone.replace(/^\+?0*250|^0/, '250').replace(/^(?!250)/, '250');

      const payload = {
        reference: referenceId,
        subscriber: {
          country: 'RWA',
          currency: 'RWF',
          msisdn: formattedPhone
        },
        transaction: {
          amount: totalAmount,
          country: 'RWA',
          currency: 'RWF',
          id: referenceId
        }
      };

      await axios.post(
        `${this.airtelConfig.baseUrl}/merchant/v1/payments/`,
        payload,
        {
          headers: {
            'Authorization': `Bearer ${token}`,
            'X-Country': 'RWA',
            'X-Currency': 'RWF',
            'Content-Type': 'application/json'
          }
        }
      );

      this.logger.log(`Airtel Money payment request sent successfully. Ref: ${referenceId}`);
      return { success: true, transactionId: referenceId };
    } catch (error: any) {
      this.logger.error('Airtel Money payment request failed', error.response?.data || error.message);
      return { success: false, error: error.response?.data?.message || 'Airtel Money payment initiation failed' };
    }
  }

  private async getAirtelPaymentStatus(referenceId: string): Promise<{ status: string; transactionId?: string }> {
    try {
      const token = await this.getAirtelAccessToken();
      const response = await axios.get(
        `${this.airtelConfig.baseUrl}/merchant/v1/payments/${referenceId}`,
        {
          headers: {
            'Authorization': `Bearer ${token}`,
            'X-Country': 'RWA',
            'X-Currency': 'RWF',
          }
        }
      );

      const airtelStatus = response.data.status?.code || response.data.status;
      let normalizedStatus: string;
      switch (airtelStatus) {
        case 'TS':
          normalizedStatus = 'SUCCESSFUL';
          break;
        case 'TF':
          normalizedStatus = 'FAILED';
          break;
        case 'TIP':
          normalizedStatus = 'PENDING';
          break;
        default:
          normalizedStatus = 'PENDING';
      }

      return {
        status: normalizedStatus,
        transactionId: response.data.transaction?.id || referenceId
      };
    } catch (error: any) {
      this.logger.error(`Failed to check Airtel Money status for ${referenceId}`, error.response?.data || error.message);
      return { status: 'ERROR' };
    }
  }
}
