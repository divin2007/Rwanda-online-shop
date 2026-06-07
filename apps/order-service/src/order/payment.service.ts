import { Injectable, Logger } from '@nestjs/common';
import axios from 'axios';
import * as crypto from 'crypto';
import { v4 as uuidv4 } from 'uuid';

export interface ParsedMtnCallback {
  orderNumber?: string;
  transactionRef: string;
  status: 'SUCCESSFUL' | 'FAILED' | 'PENDING';
  financialTransactionId?: string;
  rawStatus?: string;
}

export interface MtnDisbursementRequest {
  amount: number;
  phone: string;
  idempotencyKey: string;
  purpose: 'seller_payout' | 'rider_payout' | 'platform_commission' | 'buyer_refund';
}

export interface MtnRefundRequest {
  amount: number;
  phone: string;
  idempotencyKey: string;
  originalTransactionRef?: string;
}

export interface MtnReadiness {
  baseUrl: string;
  targetEnv: string;
  collectionConfigured: boolean;
  disbursementConfigured: boolean;
  callbackConfigured: boolean;
  productionSafe: boolean;
  missing: string[];
  callbackPath: string;
}

/**
 * Normalize a Rwandan mobile money number to MTN MoMo MSISDN format (2507XXXXXXXX, 12 digits).
 * Accepts 07XXXXXXXX, 2507XXXXXXXX, +2507XXXXXXXX, 7XXXXXXXX.
 */
export function normalizeMomoPhone(phone?: string): string {
  const digits = String(phone || '').replace(/\D/g, '');
  if (digits.startsWith('2507') && digits.length === 12) return digits;
  if (digits.startsWith('07') && digits.length === 10) return '250' + digits.slice(1);
  if (digits.startsWith('7') && digits.length === 9) return '250' + digits;
  throw new Error('Invalid Rwanda phone number');
}

@Injectable()
export class PaymentService {
  private readonly logger = new Logger(PaymentService.name);

  private readonly collectionConfig = {
    apiKey: process.env.MTN_MOMO_COLLECTION_API_KEY,
    userId: process.env.MTN_MOMO_COLLECTION_USER_ID,
    apiSecret: process.env.MTN_MOMO_COLLECTION_API_SECRET,
  };

  private readonly disbursementConfig = {
    apiKey: process.env.MTN_MOMO_DISBURSEMENT_API_KEY,
    userId: process.env.MTN_MOMO_DISBURSEMENT_USER_ID,
    apiSecret: process.env.MTN_MOMO_DISBURSEMENT_API_SECRET,
  };

  private collectionToken?: { token: string; expiresAt: number };
  private disbursementToken?: { token: string; expiresAt: number };

  private get baseUrl(): string {
    if (process.env.MTN_MOMO_BASE_URL) return process.env.MTN_MOMO_BASE_URL;
    return process.env.MTN_MOMO_TARGET_ENV === 'sandbox'
      ? 'https://sandbox.momodeveloper.mtn.com'
      : 'https://proxy.momoapi.mtn.com';
  }

  private get targetEnv(): string {
    return process.env.MTN_MOMO_TARGET_ENV || 'mtnrwanda';
  }

  private get currency(): string {
    return process.env.MTN_MOMO_CURRENCY || 'RWF';
  }

  // ── Public entry points (caller-facing names preserved) ──────────────────

  async requestPaymentPrompt(order: any): Promise<{ success: boolean; transactionId?: string; error?: string }> {
    // Auto-confirm dev bypass. NEVER active in production.
    const isNotProduction = process.env.NODE_ENV !== 'production';
    const shouldAutoConfirm = isNotProduction && (
      process.env.AUTO_CONFIRM_PAYMENTS === 'true' ||
      process.env.MTN_MOMO_TARGET_ENV === 'sandbox'
    );

    if (shouldAutoConfirm) {
      this.logger.log(`[SANDBOX] MTN MoMo dev mode intercepted. Bypassing real gateway for order ${order.orderNumber}.`);
      return { success: true, transactionId: 'DEV-AUTO-REF-' + Date.now() };
    }

    return this.requestMtnCollectionPayment(order);
  }

  async getPaymentStatus(referenceId: string, _method?: string): Promise<{ status: string; transactionId?: string }> {
    const isNotProduction = process.env.NODE_ENV !== 'production';
    const shouldAutoConfirmPayments = isNotProduction && process.env.AUTO_CONFIRM_PAYMENTS === 'true';
    if (shouldAutoConfirmPayments || referenceId?.startsWith('DEV-') || referenceId?.startsWith('SANDBOX-')) {
      return { status: 'SUCCESSFUL', transactionId: 'DEV-TX-' + referenceId };
    }

    try {
      const token = await this.getCollectionToken();
      const response = await axios.get(
        `${this.baseUrl}/collection/v1_0/requesttopay/${referenceId}`,
        {
          headers: {
            'Authorization': `Bearer ${token}`,
            'X-Target-Environment': this.targetEnv,
            'Ocp-Apim-Subscription-Key': this.collectionConfig.apiKey,
          },
          timeout: 15000,
        },
      );

      return {
        status: this.normalizeGatewayStatus(response.data?.status),
        transactionId: response.data?.financialTransactionId,
      };
    } catch (error: any) {
      this.logger.error(`Failed to check MTN MoMo status for ${referenceId}`, error.response?.data || error.message);
      return { status: 'ERROR' };
    }
  }

  // ── Collections (buyer payment) ──────────────────────────────────────────

  private async getCollectionToken(): Promise<string> {
    if (this.collectionToken && this.collectionToken.expiresAt > Date.now()) {
      return this.collectionToken.token;
    }
    const auth = Buffer
      .from(`${this.collectionConfig.userId}:${this.collectionConfig.apiSecret}`)
      .toString('base64');

    try {
      const response = await axios.post(
        `${this.baseUrl}/collection/token/`,
        {},
        {
          headers: {
            'Authorization': `Basic ${auth}`,
            'Ocp-Apim-Subscription-Key': this.collectionConfig.apiKey,
          },
          timeout: 15000,
        },
      );

      const token = response.data?.access_token;
      if (!token) throw new Error('MTN Collections response did not include an access token');
      const expiresSeconds = Number(response.data?.expires_in) || 3600;
      this.collectionToken = {
        token,
        expiresAt: Date.now() + Math.max(expiresSeconds - 60, 60) * 1000,
      };
      return token;
    } catch (error: any) {
      this.logger.error('Failed to get MTN Collections access token', error.response?.data || error.message);
      throw new Error('MTN MoMo collection authentication failed');
    }
  }

  private async requestMtnCollectionPayment(order: any): Promise<{ success: boolean; transactionId?: string; error?: string }> {
    const amount = Math.round(Number(order.financials?.totalAmount || 0));
    if (!amount || amount <= 0) {
      return { success: false, error: 'Order amount must be greater than zero' };
    }

    let partyId: string;
    try {
      partyId = normalizeMomoPhone(order.buyer?.phone);
    } catch {
      return { success: false, error: 'Use a valid Rwanda mobile money number, for example 078xxxxxxx.' };
    }

    const referenceId = uuidv4();
    this.logger.log(`Initiating MTN MoMo prompt for ${partyId} - Amount: ${amount} RWF`);

    try {
      const token = await this.getCollectionToken();
      const headers: Record<string, string> = {
        'Authorization': `Bearer ${token}`,
        'X-Reference-Id': referenceId,
        'X-Target-Environment': this.targetEnv,
        'Content-Type': 'application/json',
        'Ocp-Apim-Subscription-Key': this.collectionConfig.apiKey as string,
      };
      if (process.env.MTN_MOMO_CALLBACK_URL) {
        headers['X-Callback-Url'] = process.env.MTN_MOMO_CALLBACK_URL;
      }

      await axios.post(
        `${this.baseUrl}/collection/v1_0/requesttopay`,
        {
          amount: amount.toString(),
          currency: this.currency,
          externalId: order.orderNumber,
          payer: { partyIdType: 'MSISDN', partyId },
          payerMessage: `Payment for Order ${order.orderNumber}`,
          payeeNote: 'Rwanda Marketplace',
        },
        { headers, timeout: 20000 },
      );

      this.logger.log(`MTN MoMo Request to Pay sent successfully. Ref: ${referenceId}`);
      return { success: true, transactionId: referenceId };
    } catch (error: any) {
      this.logger.error('MTN MoMo Request to Pay failed', error.response?.data || error.message);
      return {
        success: false,
        error: error.response?.data?.message || 'MTN MoMo payment initiation failed',
      };
    }
  }

  // ── Disbursements (payouts / refunds) ────────────────────────────────────

  private async getDisbursementToken(): Promise<string> {
    if (this.disbursementToken && this.disbursementToken.expiresAt > Date.now()) {
      return this.disbursementToken.token;
    }
    const auth = Buffer
      .from(`${this.disbursementConfig.userId}:${this.disbursementConfig.apiSecret}`)
      .toString('base64');

    try {
      const response = await axios.post(
        `${this.baseUrl}/disbursement/token/`,
        {},
        {
          headers: {
            'Authorization': `Basic ${auth}`,
            'Ocp-Apim-Subscription-Key': this.disbursementConfig.apiKey,
          },
          timeout: 15000,
        },
      );

      const token = response.data?.access_token;
      if (!token) throw new Error('MTN Disbursement response did not include an access token');
      const expiresSeconds = Number(response.data?.expires_in) || 3600;
      this.disbursementToken = {
        token,
        expiresAt: Date.now() + Math.max(expiresSeconds - 60, 60) * 1000,
      };
      return token;
    } catch (error: any) {
      this.logger.error('Failed to get MTN Disbursement access token', error.response?.data || error.message);
      throw new Error('MTN MoMo disbursement authentication failed');
    }
  }

  async requestMtnDisbursement(amount: number, phone: string, idempotencyKey: string): Promise<{ success: boolean; transactionId?: string; error?: string }> {
    const value = Math.round(Number(amount || 0));
    if (!value || value <= 0) {
      return { success: false, error: 'Disbursement amount must be greater than zero' };
    }

    let partyId: string;
    try {
      partyId = normalizeMomoPhone(phone);
    } catch {
      return { success: false, error: 'Use a valid Rwanda mobile money number, for example 078xxxxxxx.' };
    }

    // X-Reference-Id IS the transaction ref. Derive deterministically from the
    // idempotency key so a retry with the same key reuses the same MTN reference.
    const referenceId = this.deterministicUuid(idempotencyKey);
    this.logger.log(`Initiating MTN MoMo disbursement for ${partyId} - Amount: ${value} RWF (ref ${referenceId})`);

    try {
      const token = await this.getDisbursementToken();
      await axios.post(
        `${this.baseUrl}/disbursement/v1_0/transfer`,
        {
          amount: value.toString(),
          currency: this.currency,
          externalId: idempotencyKey,
          payee: { partyIdType: 'MSISDN', partyId },
          payerMessage: 'Withdrawal from RMF wallet',
          payeeNote: 'Rwanda Marketplace payout',
        },
        {
          headers: {
            'Authorization': `Bearer ${token}`,
            'X-Reference-Id': referenceId,
            'X-Target-Environment': this.targetEnv,
            'Content-Type': 'application/json',
            'Ocp-Apim-Subscription-Key': this.disbursementConfig.apiKey as string,
          },
          timeout: 20000,
        },
      );

      this.logger.log(`MTN MoMo transfer accepted. Ref: ${referenceId}`);
      return { success: true, transactionId: referenceId };
    } catch (error: any) {
      this.logger.error('MTN MoMo disbursement failed', error.response?.data || error.message);
      return {
        success: false,
        error: error.response?.data?.message || error.response?.data?.error || 'MTN MoMo disbursement failed',
      };
    }
  }

  /** Poll a disbursement transfer by its reference id. */
  async getDisbursementStatus(referenceId: string): Promise<{ status: string; financialTransactionId?: string }> {
    try {
      const token = await this.getDisbursementToken();
      const response = await axios.get(
        `${this.baseUrl}/disbursement/v1_0/transfer/${referenceId}`,
        {
          headers: {
            'Authorization': `Bearer ${token}`,
            'X-Target-Environment': this.targetEnv,
            'Ocp-Apim-Subscription-Key': this.disbursementConfig.apiKey,
          },
          timeout: 15000,
        },
      );
      return {
        status: this.normalizeGatewayStatus(response.data?.status),
        financialTransactionId: response.data?.financialTransactionId,
      };
    } catch (error: any) {
      this.logger.error(`Failed to check MTN disbursement status for ${referenceId}`, error.response?.data || error.message);
      return { status: 'ERROR' };
    }
  }

  async requestMtnRefund(request: MtnRefundRequest): Promise<{ success: boolean; transactionId?: string; error?: string }> {
    const idempotencyKey = request.originalTransactionRef
      ? `${request.idempotencyKey}:${request.originalTransactionRef}`
      : request.idempotencyKey;
    return this.requestMtnDisbursement(request.amount, request.phone, idempotencyKey);
  }

  // ── Callback parsing & readiness ─────────────────────────────────────────

  parseMtnCallback(body: any): ParsedMtnCallback {
    const data = body?.data || body || {};
    const ref = data?.referenceId || data?.reference_id || body?.referenceId || body?.reference_id;
    if (!ref) {
      throw new Error('MTN callback is missing referenceId');
    }
    const rawStatus = String(data?.status || body?.status || '').trim();
    const externalId = data?.externalId || body?.externalId;

    return {
      orderNumber: externalId ? String(externalId) : undefined,
      transactionRef: String(ref),
      status: this.normalizeGatewayStatus(rawStatus),
      financialTransactionId: data?.financialTransactionId || body?.financialTransactionId,
      rawStatus,
    };
  }

  getMtnReadiness(): MtnReadiness {
    const missing: string[] = [];
    if (!this.collectionConfig.apiKey) missing.push('MTN_MOMO_COLLECTION_API_KEY');
    if (!this.collectionConfig.userId) missing.push('MTN_MOMO_COLLECTION_USER_ID');
    if (!this.collectionConfig.apiSecret) missing.push('MTN_MOMO_COLLECTION_API_SECRET');
    if (!this.disbursementConfig.apiKey) missing.push('MTN_MOMO_DISBURSEMENT_API_KEY');
    if (!this.disbursementConfig.userId) missing.push('MTN_MOMO_DISBURSEMENT_USER_ID');
    if (!this.disbursementConfig.apiSecret) missing.push('MTN_MOMO_DISBURSEMENT_API_SECRET');

    const collectionConfigured = Boolean(
      this.collectionConfig.apiKey && this.collectionConfig.userId && this.collectionConfig.apiSecret,
    );
    const disbursementConfigured = Boolean(
      this.disbursementConfig.apiKey && this.disbursementConfig.userId && this.disbursementConfig.apiSecret,
    );
    const callbackConfigured = Boolean(process.env.MTN_MOMO_CALLBACK_URL);

    return {
      baseUrl: this.baseUrl,
      targetEnv: this.targetEnv,
      collectionConfigured,
      disbursementConfigured,
      callbackConfigured,
      productionSafe: process.env.NODE_ENV !== 'production' || (collectionConfigured && disbursementConfigured),
      missing,
      callbackPath: '/api/v1/orders/payment/mtn/callback',
    };
  }

  // ── Helpers ──────────────────────────────────────────────────────────────

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

  /** Stable UUIDv4-shaped value derived from a key, so retries reuse the same X-Reference-Id. */
  private deterministicUuid(key: string): string {
    const hash = crypto.createHash('sha256').update(String(key)).digest('hex');
    return [
      hash.slice(0, 8),
      hash.slice(8, 12),
      '4' + hash.slice(13, 16),
      ((parseInt(hash.slice(16, 17), 16) & 0x3) | 0x8).toString(16) + hash.slice(17, 20),
      hash.slice(20, 32),
    ].join('-');
  }
}
