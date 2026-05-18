import { Injectable, NotFoundException, BadRequestException, Logger, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import axios from 'axios';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { OrderStatus, PaymentStatus, DisputeResolution } from '@rmf/shared-types';
import { StateConflictError } from '@rmf/shared-utils';
import { LocationService } from '@rmf/location';
import { FraudDetectionService } from './fraud-detection.service';
import { BuyerProtectionService } from './buyer-protection.service';
import { PaymentService } from './payment.service';
import { OrderGateway } from './order.gateway';

const ORDER_TRANSITIONS: Record<string, string[]> = {
  [OrderStatus.AWAITING_QUOTE]: [OrderStatus.QUOTE_SENT, OrderStatus.PLACED, OrderStatus.CANCELLED],
  [OrderStatus.QUOTE_SENT]: [OrderStatus.PLACED, OrderStatus.CANCELLED],
  [OrderStatus.SCHEDULED]: [OrderStatus.PLACED, OrderStatus.CANCELLED],
  [OrderStatus.PLACED]: [OrderStatus.CONFIRMED, OrderStatus.QUOTE_SENT, OrderStatus.CANCELLED],
  [OrderStatus.CONFIRMED]: [OrderStatus.PREPARING, OrderStatus.READY_FOR_PICKUP, OrderStatus.CANCELLED],
  [OrderStatus.PREPARING]: [OrderStatus.READY_FOR_PICKUP, OrderStatus.CANCELLED],
  [OrderStatus.READY_FOR_PICKUP]: [OrderStatus.PICKED_UP, OrderStatus.AWAITING_CONFIRMATION, OrderStatus.DELIVERED, OrderStatus.CANCELLED],
  [OrderStatus.PICKED_UP]: [OrderStatus.IN_TRANSIT, OrderStatus.AWAITING_CONFIRMATION, OrderStatus.DELIVERED],
  [OrderStatus.IN_TRANSIT]: [OrderStatus.AWAITING_CONFIRMATION, OrderStatus.DELIVERED],
  [OrderStatus.AWAITING_CONFIRMATION]: [OrderStatus.DELIVERED, OrderStatus.DISPUTED],
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
  private readonly locationService = new LocationService();

  constructor(
    @InjectModel('Transaction') private orderModel: Model<any>,
    @InjectModel('Market') private marketModel: Model<any>,
    @InjectModel('SellerProfile') private sellerModel: Model<any>,
    @InjectModel('Product') private productModel: Model<any>,
    private fraudDetection: FraudDetectionService,
    private buyerProtection: BuyerProtectionService,
    private paymentService: PaymentService,
    private orderGateway: OrderGateway
  ) { }

  private productIdFromLine(line: any): string | null {
    const productId = line?.productId?._id || line?.productId;
    return productId ? productId.toString() : null;
  }

  private async attachProductSnapshots<T extends Record<string, any>>(orders: T[]): Promise<T[]> {
    const productIds = Array.from(new Set(
      orders.flatMap((order: any) => (order.products || []).map((line: any) => this.productIdFromLine(line)).filter(Boolean))
    ));

    if (productIds.length === 0) {
      return orders;
    }

    const products = await this.productModel.find({
      _id: { $in: productIds },
      deletedAt: null,
    })
      .select('_id name images category categoryId unit price attributes')
      .lean()
      .exec();

    const productMap = new Map(products.map((product: any) => [product._id.toString(), product]));

    return orders.map((order: any) => ({
      ...order,
      products: (order.products || []).map((line: any) => {
        const product = productMap.get(this.productIdFromLine(line) || '');
        if (!product) return line;

        return {
          ...line,
          name: line.name || product.name,
          unit: line.unit || product.unit,
          category: line.category || product.category,
          categoryId: line.categoryId || product.categoryId,
          images: Array.isArray(line.images) && line.images.length > 0 ? line.images : product.images,
          imageUrl: line.imageUrl || product.images?.[0],
          attributes: line.attributes || product.attributes || {},
          currentPrice: product.price,
        };
      }),
    }));
  }

  private async snapshotOrderProducts(products: any[] = []): Promise<any[]> {
    const productIds = products.map(line => line?.productId).filter(Boolean);
    if (productIds.length === 0) return products;

    const dbProducts = await this.productModel.find({ _id: { $in: productIds }, deletedAt: null })
      .select('_id name images category categoryId unit price priceUpdatedAt weight attributes variants')
      .lean()
      .exec();
    const productMap = new Map(dbProducts.map((product: any) => [product._id.toString(), product]));

    return products.map(line => {
      const product = productMap.get(String(line.productId));
      if (!product) return line;
      const variant = line.variantId
        ? (product.variants || []).find((candidate: any) => 
            (candidate._id && String(candidate._id) === String(line.variantId)) || 
            (candidate.sku && String(candidate.sku) === String(line.variantId))
          )
        : null;
      // CRITICAL FIX: Never trust user-supplied unitPrice. Always use DB price.
      // Variant price is a relative markup over base product price.
      const unitPrice = variant 
        ? Number((product.price || 0) + (variant.price || 0)) 
        : Number(product.price);

      return {
        ...line,
        name: line.name || product.name,
        unitPrice,
        unit: line.unit || variant?.unit || product.unit,
        category: line.category || product.category,
        categoryId: line.categoryId || product.categoryId,
        imageUrl: line.imageUrl || variant?.images?.[0] || product.images?.[0],
        images: Array.isArray(line.images) && line.images.length > 0 ? line.images : (variant?.images?.length ? variant.images : product.images),
        attributes: line.attributes || variant?.attributes || product.attributes || {},
        variantId: line.variantId || variant?._id?.toString() || variant?.sku,
        variantTitle: line.variantTitle || variant?.title,
        sellerSku: line.sellerSku || variant?.sku,
        weight: line.weight ?? product.weight,
        priceSnapshotAt: line.priceSnapshotAt || product.priceUpdatedAt || new Date(),
      };
    });
  }

  private async triggerNotification(userId: string, type: string, params: any) {
    try {
      const baseUrl = process.env.NOTIFICATION_SERVICE_URL || 'http://localhost:3009/api/v1';

      // Send In-App Notification
      await axios.post(`${baseUrl}/notifications/in-app`, { userId, type, params });

      // Send Email Notification (Notification Service will resolve email from userId if missing)
      await axios.post(`${baseUrl}/notifications/email`, { userId, type, params });

      this.logger.log(`Notifications triggered (In-App & Email): ${type} for user ${userId}`);
    } catch (error) {
      this.logger.error(`Failed to trigger notifications: ${type}`, error);
    }
  }

  async getPublicStats(): Promise<any> {
    const startOfDay = new Date();
    startOfDay.setHours(0, 0, 0, 0);

    const activeSellers = await this.sellerModel.countDocuments({ isApproved: true });

    const liveDeliveries = await this.orderModel.countDocuments({
      status: { $in: [OrderStatus.PICKED_UP, OrderStatus.IN_TRANSIT] }
    });

    const ordersToday = await this.orderModel.countDocuments({
      createdAt: { $gte: startOfDay }
    });

    // Avg delivery time from completed orders
    const completedOrders = await this.orderModel.find({
      status: OrderStatus.DELIVERED
    }).exec();

    let avgDeliveryTime = 0;
    if (completedOrders.length > 0) {
      let totalMinutes = 0;
      let count = 0;
      for (const order of completedOrders) {
        const pickedUpEvent = order.history?.find((h: any) => h.status === OrderStatus.PICKED_UP);
        const deliveredEvent = order.history?.find((h: any) => h.status === OrderStatus.DELIVERED);
        if (pickedUpEvent?.createdAt && deliveredEvent?.createdAt) {
          const diffMs = new Date(deliveredEvent.createdAt).getTime() - new Date(pickedUpEvent.createdAt).getTime();
          totalMinutes += Math.floor(diffMs / 60000);
          count++;
        }
      }
      if (count > 0) {
        avgDeliveryTime = Math.ceil(totalMinutes / count);
      }
    }

    return {
      activeSellers,
      liveDeliveries,
      ordersToday,
      avgDeliveryTime
    };
  }

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
    try {
      // Fetch market coordinates for fraud detection rule F002 (distance check)
      let marketCoordinates: { lat: number; lng: number } | undefined;
      if (orderData.seller?.marketId) {
        try {
          const market = await this.marketModel.findById(orderData.seller.marketId).exec();
          if (market?.location?.coordinates) {
            marketCoordinates = { lat: market.location.coordinates[1], lng: market.location.coordinates[0] };
          }
        } catch {
          // If market lookup fails, F002 will be skipped gracefully
        }
      }

      const isQuoteRequest = orderData.attributes?.isQuoteRequest === 'true';

      const fraudCheck = await this.fraudDetection.evaluateOrderCreation(orderData, marketCoordinates);

      // Reject orders that violate hard fraud rules (F001, F002, F003, F005, F006)
      // Skip certain fraud rules for Quote Requests (like $0 checks)
      if (fraudCheck.isFlagged && fraudCheck.shouldBlock && !isQuoteRequest) {
        throw new BadRequestException(`Order blocked by fraud detection: ${fraudCheck.reason}`);
      }

      const orderNumber = `ORD-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
      const status = isQuoteRequest ? OrderStatus.AWAITING_QUOTE : (orderData.schedule ? OrderStatus.SCHEDULED : OrderStatus.PLACED);
      orderData.products = await this.snapshotOrderProducts(orderData.products || []);

      // CRITICAL FIX: Recalculate financials server-side to prevent cart manipulation
      if (!isQuoteRequest) {
        let calculatedSubtotal = 0;
        for (const item of orderData.products) {
          calculatedSubtotal += (item.unitPrice || 0) * (item.quantity || 1);
        }
        
        // Ensure user hasn't manipulated the subtotal
        if (Math.abs(orderData.financials.subtotal - calculatedSubtotal) > 1) {
          throw new BadRequestException(`Invalid subtotal. Expected ${calculatedSubtotal}`);
        }
        
        const calculatedCommission = Math.max(calculatedSubtotal * 0.015, 100);
        if (Math.abs(orderData.financials.platformCommission - calculatedCommission) > 1) {
          throw new BadRequestException(`Invalid platform commission. Expected ~${Math.round(calculatedCommission)}`);
        }
        
        const expectedTotal = calculatedSubtotal + (orderData.financials.deliveryFee || 0);
        if (Math.abs(orderData.financials.totalAmount - expectedTotal) > 1) {
          throw new BadRequestException(`Invalid total amount. Expected ${expectedTotal}`);
        }
        
        // Force the correct values
        orderData.financials.subtotal = calculatedSubtotal;
        orderData.financials.platformCommission = calculatedCommission;
        orderData.financials.totalAmount = expectedTotal;
      }

      // Ensure seller details are fully populated from SellerProfile if missing or default values are used
      if (orderData.seller?.sellerId) {
        try {
          const profile = await this.sellerModel.findById(orderData.seller.sellerId).exec();
          if (profile) {
            if (!orderData.seller.userId && profile.userId) {
              orderData.seller.userId = profile.userId.toString();
            }
            if (!orderData.seller.fullName || orderData.seller.fullName === 'Verified Seller' || orderData.seller.fullName === 'Seller') {
              orderData.seller.fullName = profile.shopDetails?.name || profile.stallName || 'Verified Seller';
            }
            if (!orderData.seller.stallId || orderData.seller.stallId === 'N/A' || orderData.seller.stallId === 'STA-UNKNOWN') {
              orderData.seller.stallId = profile.stallId || 'STA-UNKNOWN';
            }
            if (!orderData.seller.marketId && profile.marketId) {
              orderData.seller.marketId = profile.marketId.toString();
            }
          }
        } catch (e: any) {
          this.logger.warn(`Failed to lookup details for seller ${orderData.seller.sellerId}: ${e.message}`);
        }
      }

      // Save the order FIRST so it exists in the database
      const newOrder = new this.orderModel({
        ...orderData,
        orderNumber,
        status,
        statusHistory: [{
          status,
          changedBy: orderData.buyer.userId,
          changedAt: new Date(),
          note: isQuoteRequest ? 'Quote request sent by customer' : 'Order placed by customer'
        }],
        security: {
          ...orderData.security,
          isFlagged: fraudCheck.isFlagged,
          flagReason: fraudCheck.reason
        }
      });

      const saved = await newOrder.save();

      // If Quote Request, we STOP here and don't initiate payment yet
      if (isQuoteRequest) {
        const initialBrief = orderData.products?.[0]?.customization || orderData.notes || 'No brief provided';
        const initialImage = orderData.products?.[0]?.prototypeImage;

        await this.orderModel.findByIdAndUpdate(saved._id, {
          $set: {
            'payment.status': 'pending',
            messages: [{
              senderId: orderData.buyer.userId,
              senderRole: 'BUYER',
              type: 'TEXT',
              content: `Project Brief: ${initialBrief}`,
              imageUrl: initialImage,
              timestamp: new Date()
            }]
          }
        });
        const updated = await this.orderModel.findById(saved._id);
        this.orderGateway.sendOrderUpdate({ type: 'NEW_ORDER', order: updated });

        // Notify Seller about new Quote Request
        this.triggerNotification(orderData.seller.userId, 'order.placed', { orderNumber, orderId: saved._id });

        return updated;
      }

      const shouldAutoConfirmPayments = process.env.AUTO_CONFIRM_PAYMENTS === 'true';

      // THEN initiate payment (For standard orders)
      const paymentResult = await this.paymentService.requestPaymentPrompt(saved);

      if (!paymentResult.success) {
        if (shouldAutoConfirmPayments) {
          this.logger.warn(`[SANDBOX] Payment failed but auto-confirming order ${orderNumber} for local development.`);
          const autoConfirmed = await this.orderModel.findByIdAndUpdate(
            saved._id,
            {
              $set: {
                'payment.status': PaymentStatus.PAID,
                'payment.method': saved.payment?.method,
                'payment.transactionRef': 'DEV-AUTO-' + Date.now(),
                'payment.paidAt': new Date(),
                status: OrderStatus.CONFIRMED,
              }
            },
            { new: true }
          );
          this.orderGateway.sendOrderUpdate({ type: 'PAYMENT_UPDATE', orderNumber, status: 'paid', orderId: autoConfirmed._id });

          this.triggerNotification(autoConfirmed.buyer.userId, 'payment.confirmed', { amount: autoConfirmed.financials.totalAmount, orderId: autoConfirmed._id });
          this.triggerNotification(autoConfirmed.seller.userId, 'order.placed', { orderNumber, orderId: autoConfirmed._id });

          return autoConfirmed;
        }

        // PRODUCTION: Payment failed
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

      // Payment initiated successfully
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
        this.logger.error(`Order ${orderNumber} saved but could not be updated with payment ref`);
        return saved;
      }

      this.orderGateway.sendOrderUpdate({ type: 'NEW_ORDER', order: updated });

      if (paymentResult.transactionId) {
        this.startPaymentPolling(updated.orderNumber, paymentResult.transactionId);
      }

      return updated;
    } catch (error: any) {
      this.logger.error(`Failed to create order: ${error.message}`, error.stack);
      if (error instanceof BadRequestException) throw error;

      // Handle Mongoose validation errors
      if (error.name === 'ValidationError') {
        const messages = Object.values(error.errors).map((err: any) => err.message);
        throw new BadRequestException(`Validation Failed: ${messages.join(', ')}`);
      }

      throw new Error(`Internal server error during order creation: ${error.message}`);
    }
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

    // Authorization: buyer can place (accept quote) or cancel; seller can do fulfillment transitions
    // Added DELIVERED to buyerActions to allow "Confirm Receipt" flow
    const isBuyer = order.buyer?.userId?.toString() === userId;
    const isSeller = order.seller?.userId?.toString() === userId;
    const buyerActions = [OrderStatus.PLACED, OrderStatus.CANCELLED, OrderStatus.DELIVERED];
    const sellerActions = [
      OrderStatus.PREPARING, OrderStatus.READY_FOR_PICKUP,
      OrderStatus.CANCELLED
    ];
    const riderActions = [OrderStatus.PICKED_UP, OrderStatus.IN_TRANSIT, OrderStatus.AWAITING_CONFIRMATION];
    
    const isBuyerAction = buyerActions.includes(newStatus) && isBuyer;
    const isSellerAction = sellerActions.includes(newStatus) && isSeller;
    const isRiderOrSystemAction = riderActions.includes(newStatus) || userId === 'system';

    if (!isBuyerAction && !isSellerAction && !isRiderOrSystemAction) {
      throw new BadRequestException('You do not have permission to perform this status transition');
    }

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

      // Trigger rider dispatch when seller is ready
      if (newStatus === OrderStatus.READY_FOR_PICKUP) {
        this.createDeliveryForOrder(updated).catch(err => {
          this.logger.error(`Failed to trigger delivery for order ${id}: ${err.message}`);
        });
      }

      // M4 fix: split payout triggers so seller is only paid at PICKED_UP
      // and rider is only paid at DELIVERED — prevents potential double-pay.
      if (newStatus === OrderStatus.PICKED_UP) {
        // Pay seller when rider picks up the goods (handover architecture)
        this.triggerPayoutFlow(updated, 'seller').catch(err => {
          this.logger.error(`Failed to trigger seller payout for order ${id}: ${err.message}`);
        });
      }

      if (newStatus === OrderStatus.DELIVERED) {
        // Pay rider when buyer confirms delivery, and ensure seller is paid if picked_up was skipped (idempotent)
        this.triggerPayoutFlow(updated, 'both').catch(err => {
          this.logger.error(`Failed to trigger payout for order ${id}: ${err.message}`);
        });

        // Sync delivered status to delivery-service (buyer confirmed before rider marked it)
        if (updated.deliveryId) {
          const deliveryUrl = process.env.DELIVERY_SERVICE_URL || 'http://localhost:3008/api/v1';
          axios.put(`${deliveryUrl}/deliveries/${updated.deliveryId}/status`, {
            status: 'delivered'
          }).catch(err => this.logger.warn(`Failed to sync DELIVERED status to delivery service: ${err.message}`));
        }
      }

      // Trigger In-App Notifications for status changes
      if (newStatus === OrderStatus.CONFIRMED) {
        this.triggerNotification(order.seller.userId, 'order.placed', { orderNumber: order.orderNumber, orderId: order._id });
        this.triggerNotification(order.buyer.userId, 'payment.confirmed', { amount: order.financials.totalAmount, orderId: order._id });
      } else if (newStatus === OrderStatus.PREPARING) {
        this.triggerNotification(order.buyer.userId, 'order.preparing', { orderNumber: order.orderNumber, orderId: order._id });
      } else if (newStatus === OrderStatus.READY_FOR_PICKUP) {
        this.triggerNotification(order.buyer.userId, 'order.ready', { orderNumber: order.orderNumber, orderId: order._id });
      } else if (newStatus === OrderStatus.DELIVERED) {
        this.triggerNotification(order.buyer.userId, 'order.delivered', { orderNumber: order.orderNumber, orderId: order._id });
        this.triggerNotification(order.seller.userId, 'order.delivered', { orderNumber: order.orderNumber, orderId: order._id });
      } else if (newStatus === OrderStatus.CANCELLED) {
        // Only restore stock if it was previously decremented (which happens at PAID)
        if (order.payment?.status === PaymentStatus.PAID || order.status !== OrderStatus.PLACED) {
          this.incrementProductStock(updated).catch(err => {
            this.logger.error(`Failed to restore stock for cancelled order ${id}: ${err.message}`);
          });
        }
        this.triggerNotification(order.buyer.userId, 'order.cancelled', { orderNumber: order.orderNumber, orderId: order._id });
        this.triggerNotification(order.seller.userId, 'order.cancelled', { orderNumber: order.orderNumber, orderId: order._id });
      }
    }

    return updated;
  }

  // M4 fix: accepts a `payFor` param so we never pay both parties from the same call.
  // 'seller' is called at PICKED_UP; 'rider' is called at DELIVERED.
  private async triggerPayoutFlow(order: any, payFor: 'seller' | 'rider' | 'both' = 'both') {
    try {
      const deliveryUrl = process.env.DELIVERY_SERVICE_URL || 'http://localhost:3008/api/v1';
      const walletUrl = process.env.WALLET_SERVICE_URL || 'http://localhost:3007/api/v1';

      const shouldPaySeller = payFor === 'seller' || payFor === 'both';
      const shouldPayRider = payFor === 'rider' || payFor === 'both';

      // 1. Get delivery info to find the rider
      const deliveryRes = await axios.get(`${deliveryUrl}/deliveries/${order.deliveryId}`);
      const delivery = deliveryRes.data?.data;

      if (!delivery || !delivery.rider?.userId) {
        this.logger.warn(`Cannot process payout for order ${order._id}: Rider not found on delivery`);
        return;
      }

      // Robustness: If seller.userId is missing (legacy orders), try to lookup from profile
      let sellerUserId = order.seller?.userId;
      if (!sellerUserId && order.seller?.sellerId) {
        const profile = await this.sellerModel.findById(order.seller.sellerId).exec();
        sellerUserId = profile?.userId;
      }

      if (!sellerUserId) {
        this.logger.error(`Cannot process payout for order ${order._id}: Seller userId missing and could not be recovered`);
        return;
      }

      // 2. Call wallet-service to process the transaction (idempotent)
      await axios.post(`${walletUrl}/wallets/transaction`, {
        transactionId: order._id,
        orderNumber: order.orderNumber,
        description: `Order #${order.orderNumber} ${payFor === 'seller' ? 'Handover' : 'Final Delivery'} Payout`,
        sellerId: sellerUserId,
        riderId: delivery.rider.userId,
        subtotal: order.financials.subtotal,
        deliveryFee: order.financials.deliveryFee,
        sellerPayout: shouldPaySeller ? (order.financials.sellerPayout || order.financials.subtotal * 0.985) : 0,
        riderPayout: shouldPayRider ? (order.financials.riderPayout || order.financials.deliveryFee * 0.9) : 0,
        commissionFloorApplied: order.financials.platformCommission === 100
      });

      this.logger.log(`Payout (${payFor}) processed for order ${order.orderNumber}`);
    } catch (err) {
      this.logger.error(`Payout flow error: ${err.message}`);
      throw err;
    }
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
      this.orderGateway.sendOrderUpdate({
        type: 'PAYMENT_UPDATE',
        orderNumber,
        status: updated.payment.status,
        orderId: updated._id
      });

      // Notify Buyer & Seller about successful payment
      this.triggerNotification(updated.buyer.userId, 'payment.confirmed', { amount: updated.financials.totalAmount, orderId: updated._id });
      this.triggerNotification(updated.seller.userId, 'order.placed', { orderNumber, orderId: updated._id });

      // Decrement stock for all products in the order
      this.decrementProductStock(updated).catch(err => {
        this.logger.error(`Failed to decrement stock for order ${orderNumber}: ${err.message}`);
      });
    }

    return updated;
  }

  private async decrementProductStock(order: any) {
    const productUrl = process.env.PRODUCT_SERVICE_URL || 'http://localhost:3003/api/v1';
    const products = order.products || (order.product ? [order.product] : []);

    for (const item of products) {
      try {
        await axios.post(`${productUrl}/products/${item.productId}/stock`, {
          change: -item.quantity
        });
        this.logger.log(`Decremented stock for product ${item.productId} by ${item.quantity}`);
      } catch (error) {
        this.logger.error(`Stock update failed for product ${item.productId}: ${error.response?.data?.message || error.message}`);
      }
    }
  }

  private async incrementProductStock(order: any) {
    const productUrl = process.env.PRODUCT_SERVICE_URL || 'http://localhost:3003/api/v1';
    const products = order.products || (order.product ? [order.product] : []);

    for (const item of products) {
      try {
        await axios.post(`${productUrl}/products/${item.productId}/stock`, {
          change: item.quantity
        });
        this.logger.log(`Restored stock for product ${item.productId} by ${item.quantity} (Order Cancelled)`);
      } catch (error) {
        this.logger.error(`Stock restoration failed for product ${item.productId}: ${error.response?.data?.message || error.message}`);
      }
    }
  }

  private async createDeliveryForOrder(order: any): Promise<void> {
    const orderNumber = order.orderNumber;
    this.logger.log(`Order ${orderNumber} PAID. Triggering delivery-service...`);
    try {
      const deliveryUrl = process.env.DELIVERY_SERVICE_URL || 'http://localhost:3008/api/v1';
      this.logger.log(`Attempting to create delivery at ${deliveryUrl}/deliveries`);

      const seller = order.seller || {};
      const buyer = order.buyer || {};

      // Resolve market coordinates for accurate pickup location via Market Service
      let pickupCoords = { lat: -1.9441, lng: 30.0619 }; // fallback to Kigali center
      try {
        const marketUrl = process.env.MARKET_SERVICE_URL || 'http://localhost:3002/api/v1';
        const { data: market } = await axios.get(`${marketUrl}/markets/${seller.marketId}`);
        if (market?.location?.coordinates) {
          pickupCoords = { lat: market.location.coordinates[1], lng: market.location.coordinates[0] };
        }
      } catch (err) {
        this.logger.warn(`Could not fetch market coordinates for ${seller.marketId}, using default. Error: ${err.message}`);
      }

      const dropoffAddress = buyer.deliveryAddress || {};

      const response = await axios.post(`${deliveryUrl}/deliveries`, {
        orderId: order._id,
        orderNumber,
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
          deliveryFee: order.financials?.deliveryFee,
          totalAmount: order.financials?.totalAmount
        },
        notes: order.notes
      });

      const deliveryId = response.data?.data?._id;
      if (deliveryId) {
        await this.orderModel.findByIdAndUpdate(order._id, { deliveryId });
      }

      this.logger.log(`Delivery created successfully for order ${orderNumber}`);
    } catch (error) {
      this.logger.error(`Failed to create delivery for order ${orderNumber}`, error.response?.data || error.message);
    }
  }

  async raiseDispute(id: string, reason: string): Promise<any> {
    const order = await this.orderModel.findById(id);
    if (!order) throw new NotFoundException('Order not found');

    // Can only dispute delivered orders
    this.validateTransition(order.status, OrderStatus.DISPUTED, ORDER_TRANSITIONS);

    // MD3 fix: if no DELIVERED status history exists (e.g. legacy orders),
    // block the dispute to prevent unlimited dispute windows on migrated data.
    const deliveryHistory = order.statusHistory.find((h: any) => h.status === OrderStatus.DELIVERED);
    if (!deliveryHistory) {
      throw new BadRequestException('Cannot raise a dispute: no confirmed delivery record found for this order');
    }

    const hoursSinceDelivery = (Date.now() - new Date(deliveryHistory.changedAt).getTime()) / (1000 * 60 * 60);
    if (hoursSinceDelivery > 24) {
      throw new BadRequestException('Disputes must be raised within 24 hours of delivery');
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
    const order = await this.orderModel.findById(id).lean().exec();
    if (!order) throw new NotFoundException('Order not found');
    const [enriched] = await this.attachProductSnapshots([order]);
    return enriched;
  }

  async markAsRated(id: string): Promise<any> {
    const order = await this.orderModel.findById(id);
    if (!order) throw new NotFoundException('Order not found');
    order.hasBeenRated = true;
    return order.save();
  }

  async retryPayment(id: string, userId?: string): Promise<any> {
    const order = await this.orderModel.findById(id);
    if (!order) throw new NotFoundException('Order not found');

    // Authorization: only the buyer can retry payment
    if (userId && order.buyer?.userId?.toString() !== userId) {
      throw new BadRequestException('Only the buyer can retry payment');
    }

    // Only allow retry if payment is in FAILED or PENDING state
    if (order.payment?.status !== PaymentStatus.FAILED && order.payment?.status !== PaymentStatus.PENDING) {
      throw new BadRequestException(`Cannot retry payment for order in ${order.payment?.status} state`);
    }

    const shouldAutoConfirmPayments = process.env.AUTO_CONFIRM_PAYMENTS === 'true';

    const paymentResult = await this.paymentService.requestPaymentPrompt(order);
    if (!paymentResult.success) {
      if (shouldAutoConfirmPayments) {
        this.logger.warn(`[SANDBOX] Payment retry failed but auto-confirming order ${order.orderNumber} for local development.`);
        const autoConfirmed = await this.orderModel.findByIdAndUpdate(
          id,
          {
            $set: {
              'payment.status': PaymentStatus.PAID,
              'payment.method': order.payment?.method,
              'payment.transactionRef': 'DEV-AUTO-' + Date.now(),
              'payment.paidAt': new Date(),
              status: OrderStatus.CONFIRMED,
            }
          },
          { new: true }
        );
        this.orderGateway.sendOrderUpdate({
          type: 'PAYMENT_UPDATE',
          orderNumber: order.orderNumber,
          status: 'paid',
          orderId: autoConfirmed._id
        });

        this.triggerNotification(autoConfirmed.buyer.userId, 'payment.confirmed', { amount: autoConfirmed.financials.totalAmount, orderId: autoConfirmed._id });
        this.triggerNotification(autoConfirmed.seller.userId, 'order.placed', { orderNumber: order.orderNumber, orderId: autoConfirmed._id });

        return autoConfirmed;
      }

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
    const maxAttempts = process.env.NODE_ENV !== 'production' ? 6 : 24; // 30s in dev, 2 min in prod
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
    const { sellerId, buyerId, status, isDisputed, 'dispute.resolvedAt': resolvedAt } = query;
    const filter: any = {};
    if (sellerId && sellerId !== 'all') filter['seller.userId'] = sellerId;
    if (buyerId && buyerId !== 'all') filter['buyer.userId'] = buyerId;
    if (status && status !== 'all') filter.status = { $in: status.split(',') };
    if (isDisputed === 'true') filter['dispute.isDisputed'] = true;
    if (resolvedAt === 'null') filter['dispute.resolvedAt'] = null;

    const orders = await this.orderModel.find(filter).sort({ createdAt: -1 }).lean().exec();
    const ordersWithProducts = await this.attachProductSnapshots(orders);

    // C2 fix: Removed per-order delivery HTTP calls (N+1 problem).
    // riderArrived / handoverConfirmed flags are now stored directly on the order document
    // when delivery-service updates status (via PUT /orders/:id/delivery-status).
    // This eliminates 200 concurrent HTTP calls per admin list request.
    return ordersWithProducts;
  }

  async sendQuote(id: string, financials: any, userId: string): Promise<any> {
    const order = await this.orderModel.findById(id);
    if (!order) throw new NotFoundException('Order not found');

    // Authorization: only the seller of this order can send a quote
    if (order.seller?.userId?.toString() !== userId) {
      throw new BadRequestException('Only the seller of this order can send a quote');
    }

    // Idempotency: if already QUOTE_SENT, return existing order instead of error
    if (order.status === OrderStatus.QUOTE_SENT) {
      this.logger.warn(`Idempotent quote call for order ${id} — already in QUOTE_SENT`);
      return order;
    }

    // Allow re-quote if order is PLACED but payment failed or is still pending
    if (order.status === OrderStatus.PLACED) {
      const paymentStatus = order.payment?.status;
      if (paymentStatus === PaymentStatus.PAID || paymentStatus === PaymentStatus.REFUNDED) {
        throw new BadRequestException('Cannot revise quote — payment has already been completed for this order');
      }
      this.logger.warn(`Re-quote for order ${id} — order is PLACED with payment ${paymentStatus}`);
    } else {
      this.validateTransition(order.status, OrderStatus.QUOTE_SENT, ORDER_TRANSITIONS);
    }

    const subtotal = financials.subtotal || 0;
    const platformCommission = Math.max(subtotal * 0.015, 100);

    // Use the delivery fee from the order if the buyer already set their location
    const deliveryFee = order.financials?.deliveryFee > 0 ? order.financials.deliveryFee : (financials.deliveryFee || 500);
    const gatewayFee = Math.ceil((subtotal + deliveryFee) * 0.02);

    const updatedFinancials = {
      subtotal,
      deliveryFee,
      platformCommission,
      gatewayFee,
      totalAmount: subtotal + deliveryFee + gatewayFee,
      sellerPayout: subtotal - platformCommission,
      riderPayout: Math.ceil(deliveryFee * 0.9),
      note: financials.note,
    };

    const updated = await this.orderModel.findByIdAndUpdate(
      id,
      {
        $set: {
          status: OrderStatus.QUOTE_SENT,
          financials: updatedFinancials
        },
        $push: {
          statusHistory: {
            status: OrderStatus.QUOTE_SENT,
            changedBy: userId,
            changedAt: new Date(),
            note: `Artisan sent a quote: ${subtotal} RWF`
          },
          messages: {
            senderId: userId,
            senderRole: 'SELLER',
            type: 'QUOTE',
            content: financials.note || `I have sent a quote for ${subtotal.toLocaleString()} RWF`,
            quoteAmount: subtotal,
            timestamp: new Date()
          }
        }
      },
      { returnDocument: 'after' }
    );

    if (updated) {
      const lastMsg = updated.messages[updated.messages.length - 1];
      this.orderGateway.sendOrderUpdate({
        type: 'NEW_MESSAGE',
        orderId: id,
        message: lastMsg,
        status: OrderStatus.QUOTE_SENT
      });
      this.orderGateway.sendOrderUpdate({ type: 'STATUS_UPDATE', orderId: id, status: OrderStatus.QUOTE_SENT });

      // Notify Buyer about new Quote
      this.triggerNotification(updated.buyer.userId, 'order.ready', { orderNumber: updated.orderNumber, orderId: id });
    }

    return updated;
  }

  async counterOffer(id: string, subtotal: number, note: string | undefined, userId: string): Promise<any> {
    const order = await this.orderModel.findById(id);
    if (!order) throw new NotFoundException('Order not found');

    // Authorization: only the buyer of this order can send a counter-offer
    if (order.buyer?.userId?.toString() !== userId) {
      throw new BadRequestException('Only the buyer can send a counter-offer');
    }

    // Order must be in QUOTE_SENT status
    if (order.status !== OrderStatus.QUOTE_SENT) {
      throw new BadRequestException(`Cannot send counter-offer — order is in ${order.status} status`);
    }

    // Recalculate financials with counter-offer amount
    const platformCommission = Math.max(subtotal * 0.015, 100);
    const deliveryFee = order.financials?.deliveryFee || 1000;
    const gatewayFee = Math.ceil((subtotal + deliveryFee) * 0.02);

    const updatedFinancials = {
      subtotal,
      deliveryFee,
      platformCommission,
      gatewayFee,
      totalAmount: subtotal + deliveryFee + gatewayFee,
      sellerPayout: subtotal - platformCommission,
      riderPayout: Math.ceil(deliveryFee * 0.9)
    };

    const updated = await this.orderModel.findByIdAndUpdate(
      id,
      {
        $set: {
          status: OrderStatus.AWAITING_QUOTE,
          financials: updatedFinancials
        },
        $push: {
          statusHistory: {
            status: OrderStatus.AWAITING_QUOTE,
            changedBy: userId,
            changedAt: new Date(),
            note: `Buyer sent a counter-offer: ${subtotal} RWF`
          },
          messages: {
            senderId: userId,
            senderRole: 'BUYER',
            type: 'COUNTER_QUOTE',
            content: note || `I would like to propose ${subtotal.toLocaleString()} RWF instead.`,
            quoteAmount: subtotal,
            timestamp: new Date()
          }
        }
      },
      { returnDocument: 'after' }
    );

    if (updated) {
      const lastMsg = updated.messages[updated.messages.length - 1];
      this.orderGateway.sendOrderUpdate({
        type: 'NEW_MESSAGE',
        orderId: id,
        message: lastMsg,
        status: OrderStatus.AWAITING_QUOTE
      });
      this.orderGateway.sendOrderUpdate({ type: 'STATUS_UPDATE', orderId: id, status: OrderStatus.AWAITING_QUOTE });

      // Notify Seller about Counter Offer
      this.triggerNotification(updated.seller.userId, 'order.placed', { orderNumber: updated.orderNumber, orderId: id });
    }

    return updated;
  }

  async rejectQuote(id: string, reason: string, userId: string): Promise<any> {
    const order = await this.orderModel.findById(id);
    if (!order) throw new NotFoundException('Order not found');

    // Authorization: only the buyer can reject a quote
    if (order.buyer?.userId?.toString() !== userId) {
      throw new BadRequestException('Only the buyer can reject a quote');
    }

    // Validate transition QUOTE_SENT → CANCELLED
    this.validateTransition(order.status, OrderStatus.CANCELLED, ORDER_TRANSITIONS);

    const updated = await this.orderModel.findByIdAndUpdate(
      id,
      {
        $set: { status: OrderStatus.CANCELLED },
        $push: {
          statusHistory: {
            status: OrderStatus.CANCELLED,
            changedBy: userId,
            changedAt: new Date(),
            note: reason || 'Buyer rejected the quote'
          },
          messages: {
            senderId: userId,
            senderRole: 'BUYER',
            type: 'TEXT',
            content: reason || 'I have decided to decline this quote. Thank you.',
            timestamp: new Date()
          }
        }
      },
      { returnDocument: 'after' }
    );

    if (updated) {
      this.orderGateway.sendOrderUpdate({ type: 'STATUS_UPDATE', orderId: id, status: OrderStatus.CANCELLED });
    }

    return updated;
  }

  async addMessage(id: string, messageData: { senderId: string, senderRole: string, content: string, imageUrl?: string, type?: string, quoteAmount?: number }, authenticatedUserId: string): Promise<any> {
    this.logger.log(`Adding message to order ${id} from ${messageData.senderRole}`);
    try {
      const order = await this.orderModel.findById(id).exec();
      if (!order) throw new NotFoundException('Order not found');

      // Authorization: only the buyer or seller of this order can add messages
      const isBuyer = order.buyer?.userId?.toString() === authenticatedUserId;
      const isSeller = order.seller?.userId?.toString() === authenticatedUserId;
      if (!isBuyer && !isSeller) {
        throw new BadRequestException('You are not a participant in this order');
      }

      // Validate senderRole matches the authenticated user
      if ((isBuyer && messageData.senderRole !== 'BUYER') || (isSeller && messageData.senderRole !== 'SELLER')) {
        throw new BadRequestException('Sender role does not match authenticated user');
      }

      const updated = await this.orderModel.findByIdAndUpdate(
        id,
        {
          $push: {
            messages: {
              ...messageData,
              timestamp: new Date()
            }
          }
        },
        { returnDocument: 'after' }
      ).exec();

      if (!updated) {
        this.logger.warn(`Failed to add message: Order ${id} not found`);
        throw new NotFoundException('Order not found');
      }

      // Convert to plain object to ensure clean serialization over WebSocket
      const plainOrder = updated.toObject();
      const messages = plainOrder.messages || [];
      const lastMessage = messages.length > 0 ? messages[messages.length - 1] : null;

      if (lastMessage) {
        this.orderGateway.sendOrderUpdate({
          type: 'NEW_MESSAGE',
          orderId: id,
          message: lastMessage
        });
      }

      return plainOrder;
    } catch (error) {
      this.logger.error(`Error adding message to order ${id}: ${error.message}`, error.stack);
      if (error instanceof NotFoundException) throw error;
      throw new BadRequestException('Failed to add message. Check order ID and message format.');
    }
  }

  async updateDeliveryAddress(id: string, address: string, coordinates: { lat: number; lng: number }, userId: string): Promise<any> {
    const order = await this.orderModel.findById(id);
    if (!order) throw new NotFoundException('Order not found');

    // Authorization: only the buyer can update delivery address
    if (order.buyer?.userId?.toString() !== userId) {
      throw new BadRequestException('Only the buyer can update the delivery address');
    }

    // Only allow during negotiation or before payment
    const allowedStatuses = [OrderStatus.AWAITING_QUOTE, OrderStatus.QUOTE_SENT, OrderStatus.PLACED];
    if (!allowedStatuses.includes(order.status) || order.payment?.status === 'paid') {
      throw new BadRequestException('Cannot update delivery address at this stage');
    }

    // M6 fix: use the shared LocationService from @rmf/location instead of
    // duplicating the Haversine formula here.
    let deliveryFee = 500; // minimum 500 RWF
    try {
      const market = await this.marketModel.findById(order.seller?.marketId).exec();
      if (market?.location?.coordinates) {
        const marketPoint = { lat: market.location.coordinates[1], lng: market.location.coordinates[0] };
        // calculateDistance returns km
        const dist = this.locationService.calculateDistance(marketPoint, coordinates);
        // M9 fix: fee per 5km band read from env; defaults to 500 RWF
        const feePerBand = Number(process.env.DELIVERY_FEE_PER_5KM) || 500;
        deliveryFee = Math.max(Math.ceil(dist / 5) * feePerBand, feePerBand);
      }
    } catch {
      this.logger.warn(`Could not calculate delivery fee from market for order ${id}`);
    }

    const updated = await this.orderModel.findByIdAndUpdate(
      id,
      {
        $set: {
          'buyer.deliveryAddress': { address, coordinates },
          'financials.deliveryFee': deliveryFee,
        },
        $push: {
          messages: {
            senderId: userId,
            senderRole: 'BUYER',
            type: 'TEXT',
            content: `📍 Delivery location set: ${address} (Fee: ${deliveryFee.toLocaleString()} RWF)`,
            timestamp: new Date()
          }
        }
      },
      { returnDocument: 'after' }
    );

    if (updated) {
      const lastMsg = updated.messages[updated.messages.length - 1];
      this.orderGateway.sendOrderUpdate({
        type: 'NEW_MESSAGE',
        orderId: id,
        message: lastMsg
      });
      this.orderGateway.sendOrderUpdate({
        type: 'LOCATION_UPDATE',
        orderId: id,
        deliveryFee,
        address,
        coordinates
      });
    }

    return updated;
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
