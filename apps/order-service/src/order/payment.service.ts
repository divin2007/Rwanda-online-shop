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

  private async getAccessToken(): Promise<string> {
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

  async requestPaymentPrompt(order: any): Promise<{ success: boolean; transactionId?: string; error?: string }> {
    const { totalAmount } = order.financials;
    const { phone } = order.buyer;
    const referenceId = uuidv4();

    this.logger.log(`Initiating REAL MTN MoMo prompt for ${phone} - Amount: ${totalAmount} RWF`);

    try {
      const token = await this.getAccessToken();
      
      const payload = {
        amount: totalAmount.toString(),
        currency: 'RWF',
        externalId: order.orderNumber,
        payer: {
          partyIdType: 'MSISDN',
          partyId: phone.startsWith('0') ? '250' + phone.substring(1) : phone
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
      
      // Fallback for testing: if API fails but we are in dev/test, maybe return success? 
      // User said "FULLY INTEGRATED", so we should fail if it fails.
      return { success: false, error: error.response?.data?.message || 'Payment initiation failed' };
    }
  }

  async getPaymentStatus(referenceId: string): Promise<{ status: string; transactionId?: string }> {
    try {
      const token = await this.getAccessToken();
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
}
