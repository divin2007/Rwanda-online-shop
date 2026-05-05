import { Injectable, NotFoundException, BadRequestException, Logger, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import axios from 'axios';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { OrderStatus, PaymentStatus, DisputeResolution } from '@rmf/shared-types';
import { StateConflictError } from '@rmf/shared-utils';
import { FraudDetectionService } from './fraud-detection.service';
import { BuyerProtectionService } from './buyer-protection.service';
import { PaymentService } from './payment.service';
import { OrderGateway } from './order.gateway';

const ORDER_TRANSITIONS: Record<string, string[]> = {
  [OrderStatus.SCHEDULED]: [OrderStatus.PLACED, OrderStatus.CANCELLED],
  [OrderStatus.PLACED]: [OrderStatus.CONFIRMED, OrderStatus.CANCELLED],
  [OrderStatus.CONFIRMED]: [OrderStatus.PICKED_UP, OrderStatus.CANCELLED], // CANCELLED added for refunds
  [OrderStatus.PICKED_UP]: [OrderStatus.IN_TRANSIT],
  [OrderStatus.IN_TRANSIT]: [OrderStatus.DELIVERED],
  [OrderStatus.DELIVERED]: [OrderStatus.DISPUTED],
  [OrderStatus.DISPUTED]: [OrderStatus.RESOLVED],
  [OrderStatus.CANCELLED]: [],
  [OrderStatus.RESOLVED]: []
};

const PAYMENT_TRANSITIONS: Record<string, string[]> = {
  [PaymentStatus.PENDING]: [PaymentStatus.PAID, PaymentStatus.FAILED],
  [PaymentStatus.FAILED]: [PaymentStatus.PENDING], // Retry mechanism
  [PaymentStatus.PAID]: [PaymentStatus.REFUNDED],
  [PaymentStatus.REFUNDED]: []
};

@Injectable()
export class OrderService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(OrderService.name);
  private readonly paymentPollingIntervals = new Map<string, NodeJS.Timeout>();

  constructor(
    @InjectModel('Transaction') private orderModel: Model<any>,
    private fraudDetection: FraudDetectionService,
    private buyerProtection: BuyerProtectionService,
    private paymentService: PaymentService,
    private orderGateway: OrderGateway
  ) {}

  async onModuleInit() {
    // Recover payment polling for orders in PENDING status after a restart
    this.logger.log('Recovering pending payment polls after restart...');
    try {
      const pendingOrders = await this.orderModel.find({
        'payment.status': PaymentStatus.PENDING,
        'payment.transactionRef': { $exists: true, $ne: null }
      }).exec();

      for (const order of pendingOrders) {
        if (order.payment?.transactionRef) {
          this.logger.log(`Resuming payment polling for order ${order.orderNumber}`);
          this.startPaymentPolling(order.orderNumber, order.payment.transactionRef);
        }
      }
      this.logger.log(`Resumed polling for ${pendingOrders.length} pending orders`);
    } catch (error) {
      this.logger.error('Failed to recover payment polls', error);
    }
  }

  async createOrder(orderData: any): Promise<any> {
    // Fetch market coordinates for fraud detection rule F002 (distance check)
    let marketCoordinates: { lat: number; lng: number } | undefined;
    if (orderData.seller?.marketId) {
      try {
        const market = await this.orderModel.db.model('Market').findById(orderData.seller.marketId).exec();
        if (market?.location?.coordinates) {
          marketCoordinates = { lat: market.location.coordinates[1], lng: market.location.coordinates[0] };
        }
      } catch {
        // If market lookup fails, F002 will be skipped gracefully
      }
    }

    const fraudCheck = await this.fraudDetection.evaluateOrderCreation(orderData, marketCoordinates);

    // Reject orders that violate hard fraud rules (F001, F002, F003, F005, F006)
    if (fraudCheck.isFlagged && fraudCheck.shouldBlock) {
      throw new BadRequestException(`Order blocked by fraud detection: ${fraudCheck.reason}`);
    }

    // Soft flags (F999 system errors) are recorded but do not block
    
    // Commission Floor: Document 7 Pricing & Commission Structure
    // 1.5% commission, min 100 RWF
    const calculatedCommission = Math.max(orderData.financials.subtotal * 0.015, 100);
    
    if (orderData.financials.platformCommission !== calculatedCommission) {
      throw new BadRequestException(`Invalid platform commission. Expected ${calculatedCommission}`);
    }

    const orderNumber = `ORD-${Date.now()}-${Math.floor(Math.random() * 1000)}`;

    const status = orderData.schedule ? OrderStatus.SCHEDULED : OrderStatus.PLACED;

    // Save the order FIRST so it exists in the database
    // This prevents charging the user if the save fails
    const newOrder = new this.orderModel({
      ...orderData,
      orderNumber,
      status,
      statusHistory: [{
        status,
        changedBy: orderData.buyer.userId,
        changedAt: new Date(),
        note: 'Order placed by customer'
      }],
      security: {
        ...orderData.security,
        isFlagged: fraudCheck.isFlagged,
        flagReason: fraudCheck.reason
      }
    });

    const saved = await newOrder.save();

    // THEN initiate payment — if this fails the order still exists for retry
    const paymentResult = await this.paymentService.requestPaymentPrompt(saved);

    if (!paymentResult.success) {
      // Payment failed, but order exists. Update it with failed payment info.
      await this.orderModel.findByIdAndUpdate(saved._id, {
        $set: {
          'payment.status': PaymentStatus.FAILED,
          'payment.method': saved.payment?.method,
          'payment.errorMessage': paymentResult.error || 'Could not reach payment provider'
        }
      });
      this.orderGateway.sendOrderUpdate({ type: 'PAYMENT_FAILED', order: saved });
      return this.orderModel.findById(saved._id);
    }

    // Payment initiated successfully — update order with reference
    const updated = await this.orderModel.findByIdAndUpdate(
      saved._id,
      {
        $set: {
          'payment.transactionRef': paymentResult.transactionId,
          'payment.status': PaymentStatus.PENDING,
          'payment.method': saved.payment?.method,
        }
      },
      { new: true }
    );

    if (!updated) {
      // Should not happen since we just saved, but handle gracefully
      this.logger.error(`Order ${orderNumber} saved but could not be updated with payment ref`);
      return saved;
    }

    // Trigger Real-time update
    this.orderGateway.sendOrderUpdate({ type: 'NEW_ORDER', order: updated });

    // Start polling for status since we might not get a callback in sandbox
    if (paymentResult.transactionId) {
      this.startPaymentPolling(updated.orderNumber, paymentResult.transactionId);
    }

    return updated;
  }

  private validateTransition(currentStatus: string, newStatus: string, transitionMap: Record<string, string[]>): void {
    const allowed = transitionMap[currentStatus];
    if (!allowed || !allowed.includes(newStatus)) {
      throw new StateConflictError(`Forbidden transition: ${currentStatus} -> ${newStatus}`);
    }
  }

  async updateOrderStatus(id: string, newStatus: OrderStatus, userId: string): Promise<any> {
    const order = await this.orderModel.findById(id);
    if (!order) throw new NotFoundException('Order not found');

    this.validateTransition(order.status, newStatus, ORDER_TRANSITIONS);

    const updated = await this.orderModel.findByIdAndUpdate(
      id,
      { 
        $set: { status: newStatus },
        $push: { 
          statusHistory: { 
            status: newStatus, 
            changedBy: userId, 
            changedAt: new Date() 
          } 
        }
      },
      { new: true }
    );
    
    if (updated) {
      this.orderGateway.sendOrderUpdate({ type: 'STATUS_UPDATE', orderId: id, status: newStatus });
    }

    return updated;
  }

  async processPaymentCallback(orderNumber: string, status: PaymentStatus, transactionRef: string): Promise<any> {
    const order = await this.orderModel.findOne({ orderNumber });
    if (!order) throw new NotFoundException('Order not found');

    this.validateTransition(order.payment.status, status, PAYMENT_TRANSITIONS);

    // F004: Payment replay check — ensure this transactionRef hasn't been used for another paid order
    if (status === PaymentStatus.PAID && transactionRef) {
      const isReplay = await this.fraudDetection.checkPaymentReplay(transactionRef, orderNumber);
      if (isReplay) {
        this.logger.warn(`F004: Payment replay detected for transactionRef ${transactionRef} on order ${orderNumber}`);
        throw new BadRequestException('Duplicate transaction reference detected');
      }
    }

    const updates: any = {
      'payment.status': status,
      'payment.transactionRef': transactionRef
    };

    if (status === PaymentStatus.PAID) {
      updates['payment.paidAt'] = new Date();
      // Auto-transition order to CONFIRMED
      this.validateTransition(order.status, OrderStatus.CONFIRMED, ORDER_TRANSITIONS);
      updates.status = OrderStatus.CONFIRMED;
    }

    const updated = await this.orderModel.findOneAndUpdate(
      { orderNumber },
      { 
        $set: updates,
        $push: {
          paymentAttempts: {
            method: order.payment.method,
            transactionRef,
            status,
            attemptedAt: new Date()
          }
        }
      },
      { new: true }
    );

    if (updated && status === PaymentStatus.PAID) {
      this.logger.log(`Order ${orderNumber} PAID. Triggering delivery-service...`);
      // Trigger delivery-service (Internal call)
      try {
        const deliveryUrl = process.env.DELIVERY_SERVICE_URL || 'http://localhost:3008/api/v1';
        // Transaction schema stores seller/pickup info under 'seller' and buyer/dropoff under 'buyer.deliveryAddress'
        const seller = updated.seller || {};
        const buyer = updated.buyer || {};
        const pickupCoords = seller.coordinates || { lat: -1.9441, lng: 30.0619 };
        const dropoffAddress = buyer.deliveryAddress || {};

        await axios.post(`${deliveryUrl}/deliveries`, {
          orderId: updated._id,
          orderNumber: updated.orderNumber,
          pickup: {
            marketId: seller.marketId,
            stallId: seller.stallId,
            coordinates: pickupCoords,
            address: seller.address || 'Market pickup'
          },
          dropoff: {
            coordinates: dropoffAddress.coordinates || pickupCoords,
            address: dropoffAddress.address || 'Customer location'
          },
          financials: {
            deliveryFee: updated.financials?.deliveryFee,
            totalAmount: updated.financials?.totalAmount
          }
        });
        this.logger.log(`Delivery created successfully for order ${orderNumber}`);
      } catch (error) {
        this.logger.error(`Failed to create delivery for order ${orderNumber}`, error.response?.data || error.message);
      }
    }

    if (updated) {
      this.orderGateway.sendOrderUpdate({ 
        type: 'PAYMENT_UPDATE', 
        orderNumber, 
        status: updated.payment.status,
        orderId: updated._id 
      });
    }

    return updated;
  }

  async raiseDispute(id: string, reason: string): Promise<any> {
    const order = await this.orderModel.findById(id);
    if (!order) throw new NotFoundException('Order not found');

    // Can only dispute delivered orders
    this.validateTransition(order.status, OrderStatus.DISPUTED, ORDER_TRANSITIONS);
    
    // 24 hour window validation
    const deliveryHistory = order.statusHistory.find((h: any) => h.status === OrderStatus.DELIVERED);
    if (deliveryHistory) {
      const hoursSinceDelivery = (Date.now() - new Date(deliveryHistory.changedAt).getTime()) / (1000 * 60 * 60);
      if (hoursSinceDelivery > 24) {
        throw new BadRequestException('Disputes must be raised within 24 hours of delivery');
      }
    }

    return await this.orderModel.findByIdAndUpdate(
      id,
      {
        $set: {
          status: OrderStatus.DISPUTED,
          'dispute.isDisputed': true,
          'dispute.reason': reason,
          'dispute.raisedAt': new Date()
        }
      },
      { new: true }
    );
  }

  async resolveDispute(id: string, resolution: DisputeResolution): Promise<any> {
    const order = await this.orderModel.findById(id);
    if (!order) throw new NotFoundException('Order not found');

    this.validateTransition(order.status, OrderStatus.RESOLVED, ORDER_TRANSITIONS);

    if (resolution === DisputeResolution.REFUND && order.financials.totalAmount <= 10000) {
      console.log(`Instant Refund processed for order ${id} via Buyer Protection Fund (1% pool).`);
      await this.buyerProtection.executeInstantRefund(id, order.financials.totalAmount, order.buyer.userId);
    } else if (resolution === DisputeResolution.REFUND) {
      await this.buyerProtection.escalateForManualReview(id, order.financials.totalAmount);
    }
    // In actual implementation, this would trigger a message to Wallet service

    return await this.orderModel.findByIdAndUpdate(
      id,
      {
        $set: {
          status: OrderStatus.RESOLVED,
          'dispute.resolvedAt': new Date(),
          'dispute.resolution': resolution
        }
      },
      { new: true }
    );
  }
  
  async getOrderById(id: string): Promise<any> {
    return this.orderModel.findById(id).exec();
  }

  async retryPayment(id: string): Promise<any> {
    const order = await this.orderModel.findById(id);
    if (!order) throw new NotFoundException('Order not found');

    // Only allow retry if payment is in FAILED or PENDING state
    if (order.payment?.status !== PaymentStatus.FAILED && order.payment?.status !== PaymentStatus.PENDING) {
      throw new BadRequestException(`Cannot retry payment for order in ${order.payment?.status} state`);
    }

    const paymentResult = await this.paymentService.requestPaymentPrompt(order);
    if (!paymentResult.success) {
      throw new BadRequestException(
        `Payment retry failed: ${paymentResult.error || 'Could not reach payment provider'}`
      );
    }

    // Update order with new payment reference
    const updated = await this.orderModel.findByIdAndUpdate(
      id,
      {
        $set: {
          'payment.transactionRef': paymentResult.transactionId,
          'payment.status': PaymentStatus.PENDING,
        }
      },
      { new: true }
    );

    this.logger.log(`Payment retry initiated for order ${order.orderNumber}. New Ref: ${paymentResult.transactionId}`);
    if (paymentResult.transactionId) {
      this.startPaymentPolling(order.orderNumber, paymentResult.transactionId);
    }

    return updated;
  }

  private async startPaymentPolling(orderNumber: string, referenceId: string) {
    let attempts = 0;
    const maxAttempts = 24; // Poll for 2 minutes (5s intervals)
    // Only auto-confirm when BOTH conditions are true:
    // 1. MTN_MOMO_TARGET_ENV is explicitly set to 'sandbox' (not just non-production)
    // 2. NODE_ENV is NOT 'production'
    // This prevents accidental auto-confirmation in production if the env var is misconfigured
    const isExplicitSandbox = process.env.MTN_MOMO_TARGET_ENV === 'sandbox';
    const isNotProduction = process.env.NODE_ENV !== 'production';
    const shouldAutoConfirm = isExplicitSandbox && isNotProduction;

    const order = await this.orderModel.findOne({ orderNumber }).exec();
    const paymentMethod = order?.payment?.method || 'MTN_MOMO';

    const poll = setInterval(async () => {
      attempts++;
      this.logger.log(`Polling payment status for ${orderNumber} (Attempt ${attempts}/${maxAttempts})...`);

      const { status, transactionId } = await this.paymentService.getPaymentStatus(referenceId, paymentMethod);

      if (status === 'SUCCESSFUL') {
        clearInterval(poll);
        this.paymentPollingIntervals.delete(orderNumber);
        await this.processPaymentCallback(orderNumber, PaymentStatus.PAID, transactionId || referenceId);
      } else if (status === 'FAILED') {
        clearInterval(poll);
        this.paymentPollingIntervals.delete(orderNumber);
        await this.processPaymentCallback(orderNumber, PaymentStatus.FAILED, referenceId);
      } else if (attempts >= maxAttempts) {
        clearInterval(poll);
        this.paymentPollingIntervals.delete(orderNumber);

        if (shouldAutoConfirm) {
          this.logger.warn(`Sandbox Timeout: Auto-confirming order ${orderNumber} for testing.`);
          await this.processPaymentCallback(orderNumber, PaymentStatus.PAID, 'SANDBOX-SUCCESS-' + referenceId);
        } else {
          this.logger.error(`Payment polling timed out for order ${orderNumber}`);
        }
      }
    }, 5000);

    // Track interval for cleanup on module destroy
    this.paymentPollingIntervals.set(orderNumber, poll);
  }

  async findAll(query: any): Promise<any> {
    const { sellerId, status } = query;
    const filter: any = {};
    if (sellerId) filter['seller.userId'] = sellerId;
    if (status) filter.status = { $in: status.split(',') };
    return this.orderModel.find(filter).sort({ createdAt: -1 }).exec();
  }

  onModuleDestroy() {
    // Clean up all payment polling intervals to prevent stale callbacks
    for (const [orderNumber, interval] of this.paymentPollingIntervals.entries()) {
      clearInterval(interval);
      this.logger.log(`Cleaned up payment polling for order ${orderNumber}`);
    }
    this.paymentPollingIntervals.clear();
  }
}
