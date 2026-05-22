import { Injectable, Logger } from '@nestjs/common';
import axios from 'axios';

@Injectable()
export class BuyerProtectionService {
  private readonly logger = new Logger(BuyerProtectionService.name);

  async executeInstantRefund(orderId: string, amount: number, buyerId: string) {
    this.logger.log(`Executing instant refund for order ${orderId} from Reserve Fund...`);

    const walletUrl = process.env.WALLET_SERVICE_URL || 'http://localhost:3007/api/v1';
    const notificationUrl = process.env.NOTIFICATION_SERVICE_URL || 'http://localhost:3009/api/v1';
    const secret = process.env.INTERNAL_SERVICE_SECRET;
    const headers = secret ? { 'x-internal-service-key': secret } : {};

    await axios.post(`${walletUrl}/wallets/transaction`, {
      transactionId: orderId,
      entries: [
        {
          type: 'debit',
          account: 'buyer_protection_reserve',
          amount,
          description: `Reserve fund refund for order ${orderId}`
        },
        {
          userId: buyerId,
          type: 'credit',
          account: 'buyer_refund',
          amount,
          description: `Buyer protection refund for order ${orderId}`
        }
      ]
    }, { headers });

    await axios.post(`${notificationUrl}/notifications/in-app`, {
      userId: buyerId,
      type: 'refund.processed',
      params: { orderId, amount, referenceType: 'Order' }
    }, { headers }).catch(error => {
      this.logger.warn(`Refund notification failed for ${buyerId}: ${error.message}`);
    });

    this.logger.log(`Refund of ${amount} RWF credited to buyer ${buyerId}.`);
    return { success: true, processedVia: 'reserve_fund', amount };
  }

  async escalateForManualReview(orderId: string, amount: number) {
    this.logger.log(`Escalating dispute for order ${orderId} (${amount} RWF) for manual Admin review.`);
    
    const notificationUrl = process.env.NOTIFICATION_SERVICE_URL || 'http://localhost:3009/api/v1';
    const secret = process.env.INTERNAL_SERVICE_SECRET;
    const headers = secret ? { 'x-internal-service-key': secret } : {};

    await axios.post(`${notificationUrl}/notifications/in-app`, {
      userId: process.env.ADMIN_USER_ID,
      type: 'dispute.manual_review',
      params: { orderId, amount, referenceType: 'Order' }
    }, { headers }).catch(error => {
      this.logger.warn(`Manual review notification failed: ${error.message}`);
    });

    return { success: true, escalated: true };
  }

  // 5C fix: seed the buyer protection reserve fund from commission on every successful payment.
  // Called from processPaymentCallback when payment status is PAID.
  // Contributes 1% of the platform commission to the reserve fund.
  async seedReserveFromCommission(orderId: string, platformCommission: number) {
    const contribution = Math.round(platformCommission * 0.01); // 1% of commission
    if (contribution <= 0) return;

    try {
      const walletUrl = process.env.WALLET_SERVICE_URL || 'http://localhost:3007/api/v1';
      const secret = process.env.INTERNAL_SERVICE_SECRET;
      const headers = secret ? { 'x-internal-service-key': secret } : {};

      await axios.post(`${walletUrl}/wallets/transaction`, {
        transactionId: `reserve-seed-${orderId}`,
        entries: [
          {
            type: 'credit',
            account: 'buyer_protection_reserve',
            amount: contribution,
            description: `Reserve fund contribution (1% of ${platformCommission} RWF commission) from order ${orderId}`
          }
        ]
      }, { headers });
      this.logger.log(`Reserve fund seeded with ${contribution} RWF from order ${orderId}`);
    } catch (error: any) {
      this.logger.warn(`Failed to seed reserve fund from order ${orderId}: ${error.message}`);
    }
  }
}
