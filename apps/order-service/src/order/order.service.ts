import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
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
export class OrderService {
  private readonly logger = new Logger(OrderService.name);

  constructor(
    @InjectModel('Transaction') private orderModel: Model<any>,
    private fraudDetection: FraudDetectionService,
    private buyerProtection: BuyerProtectionService,
    private paymentService: PaymentService,
    private orderGateway: OrderGateway
  ) {}

  async createOrder(orderData: any): Promise<any> {
    const fraudCheck = await this.fraudDetection.evaluateOrderCreation(orderData);
    
    // Commission Floor: Document 7 Pricing & Commission Structure
    // 1.5% commission, min 100 RWF
    const calculatedCommission = Math.max(orderData.financials.subtotal * 0.015, 100);
    
    if (orderData.financials.platformCommission !== calculatedCommission) {
      throw new BadRequestException(`Invalid platform commission. Expected ${calculatedCommission}`);
    }

    const orderNumber = `ORD-${Date.now()}-${Math.floor(Math.random() * 1000)}`;

    const status = orderData.schedule ? OrderStatus.SCHEDULED : OrderStatus.PLACED;

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

    // Trigger Real-time update
    this.orderGateway.sendOrderUpdate({ type: 'NEW_ORDER', order: saved });

    // Trigger Payment Prompt
    this.paymentService.requestPaymentPrompt(saved).then(res => {
      if (res.success) {
        this.logger.log(`Payment prompt sent for order ${saved.orderNumber}. Transaction ID: ${res.transactionId}`);
        // No more automatic confirmation - waiting for real callback
      }
    });

    return saved;
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

    if (updated) {
      this.orderGateway.sendOrderUpdate({ type: 'PAYMENT_UPDATE', orderNumber, status: updated.payment.status });
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

  async findAll(query: any): Promise<any> {
    const { sellerId, status } = query;
    const filter: any = {};
    if (sellerId) filter['seller.userId'] = sellerId;
    if (status) filter.status = { $in: status.split(',') };
    return this.orderModel.find(filter).sort({ createdAt: -1 }).exec();
  }
}
