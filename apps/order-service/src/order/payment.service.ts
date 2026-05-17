import { Injectable, Logger } from '@nestjs/common';
import axios from 'axios';
import { v4 as uuidv4 } from 'uuid';

@Injectable()
export class PaymentService {
  private readonly logger = new Logger(PaymentService.name);

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
    const shouldAutoConfirm =
      process.env.AUTO_CONFIRM_PAYMENTS === 'true' ||
      (process.env.NODE_ENV !== 'production' && process.env.MTN_MOMO_TARGET_ENV === 'sandbox');

    if (shouldAutoConfirm) {
      this.logger.log(`[SANDBOX] Dev mode intercepted. Bypassing real payment gateway for order ${order.orderNumber}.`);
      return { success: true, transactionId: 'DEV-AUTO-REF-' + Date.now() };
    }

    const method = order.payment?.method || 'MTN_MOMO';

    switch (method) {
      case 'AIRTEL_MONEY':
        return this.requestAirtelPayment(order);
      case 'MTN_MOMO':
      default:
        return this.requestMtnPayment(order);
    }
  }

  async getPaymentStatus(referenceId: string, method?: string): Promise<{ status: string; transactionId?: string }> {
    const shouldAutoConfirmPayments = process.env.AUTO_CONFIRM_PAYMENTS === 'true';
    if (shouldAutoConfirmPayments || referenceId?.startsWith('DEV-') || referenceId?.startsWith('SANDBOX-')) {
      return { status: 'SUCCESSFUL', transactionId: 'DEV-TX-' + referenceId };
    }

    switch (method) {
      case 'AIRTEL_MONEY':
        return this.getAirtelPaymentStatus(referenceId);
      case 'MTN_MOMO':
      default:
        return this.getMtnPaymentStatus(referenceId);
    }
  }

  // ──────────────── MTN MoMo ────────────────

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
    } catch (error) {
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
          // M8 fix: normalize all phone formats (+2507xx, 2507xx, 07xx) to 2507xx
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
    } catch (error) {
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
        status: response.data.status, // PENDING, SUCCESSFUL, FAILED
        transactionId: response.data.financialTransactionId
      };
    } catch (error) {
      this.logger.error(`Failed to check MoMo status for ${referenceId}`, error.response?.data || error.message);
      return { status: 'ERROR' };
    }
  }

  // ──────────────── Airtel Money ────────────────

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
    } catch (error) {
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

      // M8 fix: normalize all phone formats (+2507xx, 2507xx, 07xx) to 2507xx
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
    } catch (error) {
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

      // Airtel returns status field: TS (success), TF (failed), TIP (in progress)
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
    } catch (error) {
      this.logger.error(`Failed to check Airtel Money status for ${referenceId}`, error.response?.data || error.message);
      return { status: 'ERROR' };
    }
  }
}
