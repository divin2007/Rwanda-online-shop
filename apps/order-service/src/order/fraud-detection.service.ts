import { Injectable, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { LocationService } from '@rmf/location';

@Injectable()
export class FraudDetectionService {
  private readonly logger = new Logger(FraudDetectionService.name);
  private locationService: LocationService;

  constructor(
    @InjectModel('Transaction') private orderModel: Model<any>
  ) {
    this.locationService = new LocationService();
  }

  /**
   * Evaluates order data against rules F001-F007
   * Returns true if flagged, false if valid
   */
  async evaluateOrderCreation(orderData: any, marketCoordinates?: { lat: number, lng: number }): Promise<{ isFlagged: boolean; reason?: string }> {
    try {
      // F001: Velocity check - more than 5 orders from same IP in 10 minutes
      if (orderData.security?.ipAddress) {
        const tenMinutesAgo = new Date(Date.now() - 10 * 60 * 1000);
        const recentOrders = await this.orderModel.countDocuments({
          'security.ipAddress': orderData.security.ipAddress,
          createdAt: { $gte: tenMinutesAgo }
        });
        
        if (recentOrders >= 5) {
          return { isFlagged: true, reason: 'F001: Velocity limit exceeded (5+ orders per IP in 10m)' };
        }
      }

      // F002: Unusual location - Buyer delivery pin > 50km from selected market
      if (marketCoordinates && orderData.buyer?.deliveryAddress?.coordinates) {
        const distance = this.locationService.calculateDistance(
          marketCoordinates, 
          orderData.buyer.deliveryAddress.coordinates
        );
        
        if (distance > 50) {
          return { isFlagged: true, reason: `F002: Delivery coordinates excessively far from market (${distance.toFixed(1)}km)` };
        }
      }

      // F003: Price manipulation - Cart subtotal doesn't match sum of product unit prices
      // In a real app we'd fetch the product DB prices here. We'll do a basic sanity check:
      if (orderData.product && orderData.financials) {
        const expectedSubtotal = orderData.product.unitPrice * orderData.product.quantity;
        if (Math.abs(expectedSubtotal - orderData.financials.subtotal) > 1) {
          return { isFlagged: true, reason: 'F003: Price manipulation detected (Subtotal mismatch)' };
        }
      }

      // F004: Payment replay - Idempotency key reuse
      // Checked during the actual payment callback processing typically, but we can verify transactionRef uniqueness
      if (orderData.payment?.transactionRef) {
        const existingTx = await this.orderModel.findOne({ 'payment.transactionRef': orderData.payment.transactionRef });
        if (existingTx) {
          return { isFlagged: true, reason: 'F004: Payment replay detected (Duplicate transactionRef)' };
        }
      }

      // Additional sanity checks
      if (!orderData.buyer || !orderData.buyer.userId) {
        return { isFlagged: true, reason: 'F005: Missing buyer identity' };
      }
      
      if (orderData.financials.subtotal > 500000) {
        return { isFlagged: true, reason: 'F006: Abnormally high transaction value' };
      }

      return { isFlagged: false };
    } catch (error) {
      this.logger.error('Error during fraud detection evaluation', error);
      // Fail open (don't block the order), but flag it for manual review
      return { isFlagged: true, reason: 'F999: Fraud detection system error during evaluation' };
    }
  }
}
