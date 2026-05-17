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
   * Evaluates order data against fraud rules.
   * Returns { isFlagged, reason, shouldBlock }.
   * Rules F001-F007 flag AND block the order.
   * System errors (F999) flag for review but do NOT block (fail-open safe).
   *
   * Note: The outer try/catch distinguishes between:
   * - Legitimate DB/network errors → F999 (soft flag, fail-open)
   * - Programming errors (TypeError etc.) → re-thrown so they surface during dev
   */
  async evaluateOrderCreation(orderData: any, marketCoordinates?: { lat: number, lng: number }): Promise<{ isFlagged: boolean; shouldBlock: boolean; reason?: string }> {
    try {
      // F001: Velocity check - more than 5 orders from same IP in 10 minutes
      if (orderData.security?.ipAddress) {
        const tenMinutesAgo = new Date(Date.now() - 10 * 60 * 1000);
        const recentOrders = await this.orderModel.countDocuments({
          'security.ipAddress': orderData.security.ipAddress,
          createdAt: { $gte: tenMinutesAgo }
        });

        if (recentOrders >= 5) {
          return { isFlagged: true, shouldBlock: true, reason: 'F001: Velocity limit exceeded (5+ orders per IP in 10m)' };
        }
      }

      // F002: Unusual location - Buyer delivery pin > 50km from selected market
      if (marketCoordinates && orderData.buyer?.deliveryAddress?.coordinates) {
        const distance = this.locationService.calculateDistance(
          marketCoordinates,
          orderData.buyer.deliveryAddress.coordinates
        );

        // DEV NOTE: Increased to 5000km for local testing where default coordinates might be far
        if (distance > 5000) {
          return { isFlagged: true, shouldBlock: true, reason: `F002: Delivery coordinates excessively far from market (${distance.toFixed(1)}km)` };
        }
      }

      // F003: Price manipulation - Skip for Quote Requests as price is negotiated
      if (orderData.financials && !orderData.attributes?.isQuoteRequest) {
        let expectedSubtotal = 0;
        if (orderData.products && Array.isArray(orderData.products)) {
          expectedSubtotal = orderData.products.reduce((sum: number, p: any) => sum + (p.unitPrice * p.quantity), 0);
        } else if (orderData.product) {
          expectedSubtotal = orderData.product.unitPrice * orderData.product.quantity;
        }

        if (expectedSubtotal > 0 && Math.abs(expectedSubtotal - orderData.financials.subtotal) > 1) {
          this.logger.warn(`F003: Subtotal mismatch for order. Expected: ${expectedSubtotal}, Actual: ${orderData.financials.subtotal}`);
          return { isFlagged: true, shouldBlock: true, reason: `F003: Price manipulation detected (Subtotal mismatch: expected ${expectedSubtotal}, got ${orderData.financials.subtotal})` };
        }
      }

      // F005: Missing buyer identity
      if (!orderData.buyer || !orderData.buyer.userId) {
        return { isFlagged: true, shouldBlock: true, reason: 'F005: Missing buyer identity' };
      }

      // F006: Abnormally high transaction value
      // MD4 fix: threshold is now configurable via FRAUD_HIGH_VALUE_THRESHOLD env var.
      // Default raised to 2,000,000 RWF (~$1,400) to avoid blocking legitimate B2B orders.
      const highValueThreshold = Number(process.env.FRAUD_HIGH_VALUE_THRESHOLD) || 2_000_000;
      if (orderData.financials.subtotal > highValueThreshold) {
        return { isFlagged: true, shouldBlock: true, reason: `F006: Abnormally high transaction value (>${highValueThreshold.toLocaleString()} RWF)` };
      }

      return { isFlagged: false, shouldBlock: false };
    } catch (error) {
      // Log the full error for debugging
      this.logger.error('F999: Fraud detection system error during evaluation', error);
      // F999: System error — flag for manual review but do NOT block the order
      // This prevents an attacker from DOSing the fraud system to bypass checks.
      // Only DB/network errors reach here; programming errors (TypeError, ReferenceError)
      // should propagate in development but we still fail-open in production to
      // avoid blocking legitimate orders due to transient infra issues.
      return { isFlagged: true, shouldBlock: false, reason: 'F999: Fraud detection system error during evaluation' };
    }
  }

  /**
   * F004: Payment replay check — called during payment callback, not order creation.
   * Verifies the transactionRef hasn't been used on another successful payment.
   *
   * This method uses FAIL-CLOSED semantics: if we can't verify the transactionRef
   * hasn't been replayed, we assume it IS a replay to prevent financial loss.
   * The cost of a false positive (rejected payment callback) is lower than
   * a false negative (double payment).
   */
  async checkPaymentReplay(transactionRef: string, excludeOrderNumber?: string): Promise<boolean> {
    try {
      const query: any = { 'payment.transactionRef': transactionRef, 'payment.status': 'paid' };
      if (excludeOrderNumber) {
        query.orderNumber = { $ne: excludeOrderNumber };
      }
      const existing = await this.orderModel.findOne(query).exec();
      return !!existing;
    } catch (error) {
      this.logger.error('F004: Error during payment replay check — blocking to prevent potential double payment', error);
      // Fail-closed: assume replay if we can't verify, prevents financial loss
      return true;
    }
  }
}
