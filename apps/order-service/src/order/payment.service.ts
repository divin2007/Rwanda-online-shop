import { Injectable, Logger } from '@nestjs/common';
import axios from 'axios';

@Injectable()
export class PaymentService {
  private readonly logger = new Logger(PaymentService.name);

  // For production, these would be in the config service
  private readonly momoConfig = {
    apiKey: process.env.MTN_MOMO_API_KEY,
    userId: process.env.MTN_MOMO_USER_ID,
    apiSecret: process.env.MTN_MOMO_API_SECRET,
    baseUrl: 'https://proxy.momoapi.mtn.com' // Production URL
  };

  async requestPaymentPrompt(order: any): Promise<{ success: boolean; transactionId?: string; error?: string }> {
    const { totalAmount } = order.financials;
    const { phone } = order.buyer;

    this.logger.log(`Initiating MTN MoMo prompt for ${phone} - Amount: ${totalAmount} RWF`);

    // In a real implementation, we would:
    // 1. Get an Access Token from MoMo
    // 2. POST to /collection/v1_0/requesttopay
    // 3. Receive a X-Reference-Id

    try {
      // Since we are in a dev/demo environment with specific instructions for WOW factor,
      // we will simulate the prompt success and trigger a callback simulation.
      
      // MOCK PROMPT TRIGGER
      // If we had a real sandbox, we'd call axios here.
      
      // Simulate network delay
      await new Promise(resolve => setTimeout(resolve, 2000));

      this.logger.log(`[MoMo Simulator] Prompt sent to ${phone}. Waiting for user PIN.`);
      
      return { success: true, transactionId: `MOMO-${Date.now()}` };
    } catch (error) {
      this.logger.error('MoMo Payment Initiation Failed', error);
      return { success: false, error: 'Payment gateway connection failed' };
    }
  }

  /**
   * This would be called by a real MTN Webhook
   */
  async handleCallback(referenceId: string) {
    // Logic to verify payment and call OrderService.processPaymentCallback
  }
}
