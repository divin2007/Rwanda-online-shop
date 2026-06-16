import { Injectable, NotFoundException, BadRequestException, Logger, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import axios from 'axios';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { randomUUID as uuidv4 } from 'crypto';
import { OrderStatus, PaymentStatus, DisputeResolution, UserRole } from '@rmf/shared-types';
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
  private readonly escrowReleaseTimers = new Map<string, NodeJS.Timeout>();
  private readonly locationService = new LocationService();

  constructor(
    @InjectModel('Transaction') private orderModel: Model<any>,
    @InjectModel('Market') private marketModel: Model<any>,
    @InjectModel('SellerProfile') private sellerModel: Model<any>,
    @InjectModel('Product') private productModel: Model<any>,
    private fraudDetection: FraudDetectionService,
    private buyerProtection: BuyerProtectionService,
    private paymentService: PaymentService,
    private orderGateway: OrderGateway,
    @InjectModel('User') private userModel: Model<any>,
    @InjectModel('LedgerEntry') private ledgerModel: Model<any>
  ) { }

  private normalizeId(value: any): string | null {
    if (value === null || value === undefined) return null;
    if (typeof value === 'string') return value;
    if (typeof value === 'number') return String(value);
    if (typeof value.toHexString === 'function') return value.toHexString();
    if (value._id !== undefined && value._id !== value) return this.normalizeId(value._id);
    if (value.id !== undefined && value.id !== value) return this.normalizeId(value.id);
    return String(value);
  }

  private idsMatch(left: any, right: any): boolean {
    const leftId = this.normalizeId(left);
    const rightId = this.normalizeId(right);
    return Boolean(leftId && rightId && leftId === rightId);
  }

  private isOrderBuyer(order: any, userId: string): boolean {
    return this.idsMatch(order?.buyer?.userId ?? order?.buyerId, userId);
  }

  private isOrderSeller(order: any, userId: string): boolean {
    return this.idsMatch(order?.seller?.userId ?? order?.sellerUserId, userId);
  }

  private productIdFromLine(line: any): string | null {
    const productId = line?.productId?._id || line?.productId;
    return productId ? productId.toString() : null;
  }

  private async attachProductSnapshots<T extends Record<string, any>>(orders: T[]): Promise<T[]> {
    const productIds = Array.from(new Set(
      orders.flatMap((order: any) => (order.products || []).map((line: any) => this.productIdFromLine(line)).filter(Boolean))
    )).filter(id => Types.ObjectId.isValid(id));

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

  private async triggerNotification(userId: string, type: string, params: any) {
    if (!userId || userId === 'undefined' || userId === 'null') {
      return;
    }
    try {
      const channels = /security|fraud|refund|dispute|payment|quote|order/i.test(type)
        ? ['IN_APP', 'EMAIL']
        : ['IN_APP'];
      const url = `${process.env.NOTIFICATION_SERVICE_URL || 'http://localhost:3009/api/v1'}/notifications/dispatch`;
      const axios = require('axios');
      const secret = process.env.INTERNAL_SERVICE_SECRET;
      const headers = secret ? { 'x-internal-service-key': secret } : {};
      await axios.post(url, { userId, type, params, channels }, { headers });
    } catch (error: any) {
      console.error(`Failed to trigger notification: ${type}`, error.message);
    }
  }

  private async triggerAdminNotification(type: string, params: any) {
    try {
      const url = `${process.env.NOTIFICATION_SERVICE_URL || 'http://localhost:3009/api/v1'}/notifications/admin-notify`;
      const axios = require('axios');
      const secret = process.env.INTERNAL_SERVICE_SECRET;
      const headers = secret ? { 'x-internal-service-key': secret } : {};
      await axios.post(url, { type, params }, { headers });
    } catch (error: any) {
      console.error(`Failed to trigger admin notification: ${type}`, error.message);
    }
  }

  private async getAssignedRiderUserId(order: any): Promise<string | null> {
    const directRiderId = this.normalizeId(
      order?.rider?.userId ||
      order?.delivery?.rider?.userId ||
      order?.riderUserId
    );
    if (directRiderId) return directRiderId;

    const deliveryId = this.normalizeId(order?.deliveryId);
    if (!deliveryId) return null;

    try {
      const deliveryUrl = process.env.DELIVERY_SERVICE_URL || 'http://localhost:3008/api/v1';
      const secret = process.env.INTERNAL_SERVICE_SECRET;
      const headers = secret ? { 'x-internal-service-key': secret } : {};
      const response = await axios.get(`${deliveryUrl}/deliveries/${deliveryId}`, { headers, timeout: 2500 });
      const delivery = response.data?.data || response.data;
      return this.normalizeId(delivery?.rider?.userId);
    } catch (error: any) {
      this.logger.warn(`Could not resolve assigned rider for message notification: ${error.message}`);
      return null;
    }
  }

  private uniqueUserIds(values: Array<string | null | undefined>): string[] {
    const seen = new Set<string>();
    for (const value of values) {
      const id = this.normalizeId(value);
      if (id) seen.add(id);
    }
    return Array.from(seen);
  }

  private messagePreview(content: string): string {
    const compact = String(content || '').replace(/\s+/g, ' ').trim();
    return compact.length > 120 ? `${compact.slice(0, 117)}...` : compact;
  }

  private async notifyOrderMessageParticipants(order: any, orderId: string, message: any): Promise<void> {
    const senderId = this.normalizeId(message?.senderId);
    if (!senderId) return;

    const buyerId = this.normalizeId(order?.buyer?.userId ?? order?.buyerId);
    const sellerId = this.normalizeId(order?.seller?.userId ?? order?.sellerUserId);
    const riderId = await this.getAssignedRiderUserId(order);
    const roleToUserId: Record<string, string | null | undefined> = {
      BUYER: buyerId,
      SELLER: sellerId,
      RIDER: riderId,
    };

    const recipientRole = String(message?.recipientRole || '').toUpperCase();
    let recipientIds: string[] = [];

    if (recipientRole && roleToUserId[recipientRole]) {
      recipientIds = this.uniqueUserIds([roleToUserId[recipientRole]]);
    } else if (message?.channel === 'DELIVERY') {
      recipientIds = message?.senderRole === 'RIDER'
        ? this.uniqueUserIds([buyerId, sellerId])
        : this.uniqueUserIds([riderId]);
    } else {
      recipientIds = this.uniqueUserIds([buyerId, sellerId]).filter(id => id !== senderId);
    }

    if (recipientIds.length === 0) {
      recipientIds = this.uniqueUserIds([buyerId, sellerId, riderId]).filter(id => id !== senderId);
    }

    const notificationParams = {
      orderId,
      orderNumber: order?.orderNumber || orderId,
      channel: message?.channel || 'ORDER',
      senderRole: message?.senderRole || 'PARTICIPANT',
      recipientRole: recipientRole || undefined,
      preview: this.messagePreview(message?.content),
    };

    const shouldNotifyAdmins = recipientRole === 'ADMIN' || message?.channel === 'DISPUTE';

    await Promise.all([
      this.triggerNotification(senderId, 'order.message.sent', notificationParams),
      ...recipientIds
        .filter(id => id !== senderId)
        .map(userId => this.triggerNotification(userId, 'order.message.received', notificationParams)),
      ...(shouldNotifyAdmins ? [this.triggerAdminNotification('order.message.received', notificationParams)] : []),
    ]);
  }

  private async snapshotOrderProducts(products: any[] = [], options: { strict?: boolean } = {}): Promise<any[]> {
    const productIds = products.map(line => line?.productId).filter(Boolean).filter(id => Types.ObjectId.isValid(id));
    if (productIds.length === 0) {
      // Strict mode (purchasable orders): every line must map to a real product,
      // otherwise the client-supplied unitPrice would survive into the financials.
      if (options.strict && products.length > 0) {
        throw new BadRequestException('Order items must reference valid products');
      }
      return products;
    }

    const dbProducts = await this.productModel.find({ _id: { $in: productIds }, deletedAt: null })
      .select('_id name images category categoryId unit price priceUpdatedAt weight attributes variants')
      .lean()
      .exec();
    const productMap = new Map(dbProducts.map((product: any) => [product._id.toString(), product]));

    return products.map(line => {
      const product = productMap.get(String(line.productId));
      if (!product) {
        if (options.strict) {
          throw new BadRequestException(`Order item "${line?.name || line?.productId || 'unknown'}" does not match an available product`);
        }
        return line;
      }
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
    try {
      const pendingOrders = await this.orderModel.find({
        'payment.status': PaymentStatus.PENDING,
        'payment.transactionRef': { $exists: true, $ne: null },
        status: OrderStatus.PLACED
      }).exec();

      for (const order of pendingOrders) {
        if (order.payment?.transactionRef) {
          this.logger.log(`Resuming payment polling for order ${order.orderNumber}`);
          this.startPaymentPolling(order.orderNumber, order.payment.transactionRef);
        }
      }
      this.logger.log(`Resumed polling for ${pendingOrders.length} pending orders`);

      const releasePendingOrders = await this.orderModel.find({
        status: { $in: [OrderStatus.DELIVERED, OrderStatus.RESOLVED] },
        'settlement.status': 'release_pending',
        'payment.status': PaymentStatus.PAID,
        $or: [
          { 'dispute.isDisputed': { $ne: true } },
          { 'dispute.resolvedAt': { $exists: true, $ne: null } },
        ],
      }).exec();

      for (const order of releasePendingOrders) {
        const releaseAt = order.settlement?.releaseAvailableAt ? new Date(order.settlement.releaseAvailableAt) : new Date();
        this.scheduleEscrowRelease(order, releaseAt);
      }
      this.logger.log(`Scheduled escrow release checks for ${releasePendingOrders.length} order(s)`);
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
      orderData.products = await this.snapshotOrderProducts(orderData.products || [], { strict: !isQuoteRequest });

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
              channel: 'ORDER',
              recipientRole: 'SELLER',
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

      // CRITICAL: Auto-confirm must NEVER activate in production
      const isNotProduction = process.env.NODE_ENV !== 'production';
      const shouldAutoConfirmPayments = isNotProduction && process.env.AUTO_CONFIRM_PAYMENTS === 'true';

      // THEN initiate payment (For standard orders)
      const paymentResult = await this.paymentService.requestPaymentPrompt(saved);

      if (!paymentResult.success) {
        await this.orderModel.findByIdAndUpdate(saved._id, {
          $push: {
            paymentAttempts: {
              method: saved.payment?.method,
              status: PaymentStatus.FAILED,
              attemptedAt: new Date(),
              failureReason: paymentResult.error || 'Could not reach payment provider',
            }
          }
        });

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
          },
          $push: {
            paymentAttempts: {
              method: saved.payment?.method,
              transactionRef: paymentResult.transactionId,
              status: PaymentStatus.PENDING,
              attemptedAt: new Date(),
            }
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

  async updateOrderStatus(id: string, newStatus: OrderStatus, userId: string, actorRole?: string): Promise<any> {
    const order = await this.orderModel.findById(id);
    if (!order) throw new NotFoundException('Order not found');

    // Authorization: buyer can place (accept quote) or cancel; seller can do fulfillment transitions
    // Added DELIVERED to buyerActions to allow "Confirm Receipt" flow
    const isBuyer = this.isOrderBuyer(order, userId);
    const isSeller = this.isOrderSeller(order, userId);
    const buyerActions = [OrderStatus.PLACED, OrderStatus.CANCELLED, OrderStatus.DELIVERED];
    const sellerActions = [
      OrderStatus.PREPARING, OrderStatus.READY_FOR_PICKUP,
      OrderStatus.CANCELLED
    ];
    const riderActions = [OrderStatus.PICKED_UP, OrderStatus.IN_TRANSIT, OrderStatus.AWAITING_CONFIRMATION];

    // Rider-side transitions only come from delivery-service (internal key), the
    // scheduler ('system'), or an admin — never directly from an arbitrary JWT,
    // otherwise any authenticated user could walk any order through fulfillment.
    const isInternalActor = userId === 'system' || userId === 'internal-service';
    const isAdminActor = String(actorRole || '').toUpperCase() === UserRole.ADMIN;

    const isBuyerAction = buyerActions.includes(newStatus) && isBuyer;
    const isSellerAction = sellerActions.includes(newStatus) && isSeller;
    const isRiderOrSystemAction = riderActions.includes(newStatus) && (isInternalActor || isAdminActor);

    if (!isAdminActor && !isInternalActor && !isBuyerAction && !isSellerAction && !isRiderOrSystemAction) {
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

      // Escrow release: funds stay held after buyer payment and rider pickup.
      // Payouts only begin once delivery is confirmed.
      if (newStatus === OrderStatus.PICKED_UP) {
        this.updateSettlementState(updated._id, {
          'settlement.status': 'release_pending',
          'settlement.lastError': null,
        }).catch(err => {
          this.logger.error(`Failed to update escrow release state for order ${id}: ${err.message}`);
        });
      }

      if (newStatus === OrderStatus.DELIVERED) {
        // Funds remain in escrow through the dispute window, then release automatically.
        this.prepareEscrowRelease(updated).catch(err => {
          this.logger.error(`Failed to schedule escrow release for order ${id}: ${err.message}`);
        });

        // Increment totalOrders for purchased products in the database
        this.incrementProductOrders(updated).catch(err => {
          this.logger.error(`Failed to increment product orders count for order ${id}: ${err.message}`);
        });

        // Sync delivered status to delivery-service (buyer confirmed before rider marked it)
        if (updated.deliveryId) {
          const deliveryUrl = process.env.DELIVERY_SERVICE_URL || 'http://localhost:3008/api/v1';
          const secret = process.env.INTERNAL_SERVICE_SECRET;
          const headers = secret ? { 'x-internal-service-key': secret } : {};
          axios.put(`${deliveryUrl}/deliveries/${updated.deliveryId}/internal/status`, {
            status: 'delivered'
          }, { headers }).catch(err => this.logger.warn(`Failed to sync DELIVERED status to delivery service: ${err.message}`));
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

  private getPlatformSettlementPhone(): string | null {
    return process.env.PAYPACK_PLATFORM_PHONE
      || process.env.RMF_PLATFORM_MOMO_NUMBER
      || process.env.PLATFORM_MOMO_NUMBER
      || null;
  }

  private toObjectId(value: any): Types.ObjectId | null {
    const id = this.normalizeId(value);
    return id && Types.ObjectId.isValid(id) ? new Types.ObjectId(id) : null;
  }

  private async getSellerSettlementTarget(order: any): Promise<{ userId: string | null; phone: string | null }> {
    let sellerUserId = this.normalizeId(order?.seller?.userId || order?.sellerUserId);
    if (!sellerUserId && order?.seller?.sellerId) {
      const profile = await this.sellerModel.findById(order.seller.sellerId).select('userId').lean().exec();
      sellerUserId = this.normalizeId(profile?.userId);
    }

    const sellerUser = sellerUserId
      ? await this.userModel.findById(sellerUserId).select('phone').lean().exec()
      : null;

    return {
      userId: sellerUserId,
      phone: sellerUser?.phone || order?.seller?.phone || null,
    };
  }

  private async getDeliveryForSettlement(order: any): Promise<any | null> {
    const deliveryId = this.normalizeId(order?.deliveryId || order?.delivery?._id);
    if (!deliveryId) return null;

    try {
      const deliveryUrl = process.env.DELIVERY_SERVICE_URL || 'http://localhost:3008/api/v1';
      const secret = process.env.INTERNAL_SERVICE_SECRET;
      const headers = secret ? { 'x-internal-service-key': secret } : {};
      const deliveryRes = await axios.get(`${deliveryUrl}/deliveries/${deliveryId}`, { headers, timeout: 5000 });
      return deliveryRes.data?.data || deliveryRes.data || null;
    } catch (error: any) {
      this.logger.warn(`Could not load delivery ${deliveryId} for settlement: ${error.message}`);
      return null;
    }
  }

  private async getRiderSettlementTarget(order: any): Promise<{ userId: string | null; phone: string | null; delivery: any | null }> {
    const delivery = await this.getDeliveryForSettlement(order);
    const riderUserId = this.normalizeId(delivery?.rider?.userId || order?.rider?.userId || order?.delivery?.rider?.userId);
    let phone = delivery?.rider?.phone || order?.rider?.phone || order?.delivery?.rider?.phone || null;

    if (!phone && riderUserId) {
      const riderUser = await this.userModel.findById(riderUserId).select('phone').lean().exec();
      phone = riderUser?.phone || null;
    }

    return { userId: riderUserId, phone, delivery };
  }

  private async recordSettlementLedger(input: {
    order: any;
    userId?: string | null;
    account: string;
    amount: number;
    type?: 'credit' | 'debit';
    description: string;
    externalRef?: string;
    status?: string;
    metadata?: Record<string, any>;
  }) {
    const transactionId = this.toObjectId(input.order?._id);
    if (!transactionId) {
      throw new Error('Cannot record settlement ledger without a valid order id');
    }

    const query: Record<string, any> = {
      transactionId,
      account: input.account,
    };
    const userObjectId = this.toObjectId(input.userId);
    if (userObjectId) query.userId = userObjectId;

    const existing = await this.ledgerModel.findOne(query).lean().exec();
    if (existing) return existing;

    return new this.ledgerModel({
      ledgerId: `SET-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      userId: userObjectId || undefined,
      transactionId,
      type: input.type || 'credit',
      account: input.account,
      amount: Math.round(Number(input.amount || 0)),
      currency: 'RWF',
      description: input.description,
      balanceAfter: 0,
      provider: 'paypack',
      externalRef: input.externalRef,
      status: input.status || 'posted',
      metadata: {
        orderNumber: input.order?.orderNumber,
        accountingOnly: true,
        ...input.metadata,
      },
    }).save();
  }

  private async updateSettlementState(orderId: any, fields: Record<string, any>) {
    await this.orderModel.findByIdAndUpdate(orderId, {
      $set: {
        ...fields,
        'settlement.updatedAt': new Date(),
      },
    }).exec();
  }

  private getEscrowReleaseDelayMs(): number {
    if (process.env.ESCROW_RELEASE_DELAY_HOURS !== undefined) {
      return Math.max(0, Number(process.env.ESCROW_RELEASE_DELAY_HOURS || 0) * 60 * 60 * 1000);
    }
    return process.env.NODE_ENV === 'production' ? 24 * 60 * 60 * 1000 : 0;
  }

  private clearEscrowReleaseTimer(orderId: any) {
    const id = this.normalizeId(orderId);
    if (!id) return;
    const timer = this.escrowReleaseTimers.get(id);
    if (timer) clearTimeout(timer);
    this.escrowReleaseTimers.delete(id);
  }

  private scheduleEscrowRelease(order: any, releaseAt: Date) {
    const orderId = this.normalizeId(order?._id || order?.id);
    if (!orderId) return;
    this.clearEscrowReleaseTimer(orderId);
    const delayMs = Math.max(0, releaseAt.getTime() - Date.now());
    const timer = setTimeout(() => {
      this.releaseEscrowIfReady(orderId).catch(err => {
        this.logger.error(`Escrow release failed for order ${orderId}: ${err.message}`);
      });
    }, delayMs);
    this.escrowReleaseTimers.set(orderId, timer);
  }

  private async prepareEscrowRelease(order: any) {
    const delayMs = this.getEscrowReleaseDelayMs();
    const releaseAt = new Date(Date.now() + delayMs);
    await this.updateSettlementState(order._id, {
      'settlement.status': 'release_pending',
      'settlement.releaseAvailableAt': releaseAt,
      'settlement.payoutBlockedReason': delayMs > 0 ? 'Waiting for buyer dispute window to expire' : null,
      'settlement.lastError': null,
    });

    if (delayMs > 0) {
      this.scheduleEscrowRelease(order, releaseAt);
      this.logger.log(`Escrow payout for order ${order.orderNumber} scheduled after dispute window at ${releaseAt.toISOString()}`);
      return;
    }

    await this.releaseEscrowIfReady(this.normalizeId(order._id)!);
  }

  private async releaseEscrowIfReady(orderId: string) {
    const order = await this.orderModel.findById(orderId).exec();
    if (!order) return;
    if (order.status !== OrderStatus.DELIVERED && order.status !== OrderStatus.RESOLVED) return;
    if (order.dispute?.isDisputed && !order.dispute?.resolvedAt) {
      await this.updateSettlementState(order._id, {
        'settlement.status': 'release_pending',
        'settlement.payoutBlockedReason': 'Active buyer dispute',
      });
      return;
    }
    const releaseAt = order.settlement?.releaseAvailableAt ? new Date(order.settlement.releaseAvailableAt) : new Date();
    if (releaseAt.getTime() > Date.now()) {
      this.scheduleEscrowRelease(order, releaseAt);
      return;
    }

    await this.updateSettlementState(order._id, {
      'settlement.releaseTriggeredAt': new Date(),
      'settlement.payoutBlockedReason': null,
    });
    await this.triggerPayoutFlow(order, 'both');
    this.clearEscrowReleaseTimer(order._id);
  }

  private async paypackCashoutAndRecord(input: {
    order: any;
    userId?: string | null;
    phone: string;
    amount: number;
    account: string;
    purpose: 'seller_payout' | 'rider_payout' | 'platform_commission';
    description: string;
    stateRefPath: string;
    stateStatusPath: string;
    stateDatePath: string;
  }) {
    const amount = Math.round(Number(input.amount || 0));
    if (amount <= 0) {
      await this.updateSettlementState(input.order._id, { [input.stateStatusPath]: 'skipped' });
      return { skipped: true };
    }

    const existing = await this.recordSettlementLedger({
      order: input.order,
      userId: input.userId,
      account: input.account,
      amount,
      description: `${input.description} (idempotency check)`,
      status: 'reserved',
      metadata: { purpose: input.purpose },
    });

    if (existing?.status === 'posted' && existing?.externalRef) {
      return { success: true, transactionId: existing.externalRef, duplicate: true };
    }

    const payout = await this.paymentService.requestPaypackCashout({
      amount,
      phone: input.phone,
      idempotencyKey: `${input.purpose}:${this.normalizeId(input.order._id)}:${amount}`,
      purpose: input.purpose,
    });

    if (!payout.success) {
      await this.ledgerModel.updateOne(
        { _id: existing._id },
        {
          $set: {
            account: `${input.account}_failed`,
            status: 'failed',
            description: `${input.description} failed: ${payout.error || 'Paypack error'}`,
            externalRef: payout.transactionId,
            metadata: {
              ...(existing.metadata || {}),
              error: payout.error,
            },
          },
        }
      ).exec();
      await this.updateSettlementState(input.order._id, {
        [input.stateStatusPath]: 'failed',
        'settlement.status': 'failed',
        'settlement.lastError': payout.error || 'Paypack cashout failed',
      });
      throw new Error(payout.error || 'Paypack cashout failed');
    }

    await this.ledgerModel.updateOne(
      { _id: existing._id },
      {
        $set: {
          status: 'posted',
          description: input.description,
          externalRef: payout.transactionId,
          metadata: {
            ...(existing.metadata || {}),
            phoneLast4: String(input.phone).slice(-4),
          },
        },
      }
    ).exec();

    await this.updateSettlementState(input.order._id, {
      [input.stateStatusPath]: 'paid',
      [input.stateRefPath]: payout.transactionId,
      [input.stateDatePath]: new Date(),
    });

    return payout;
  }

  // Real money stays in PayPack merchant account.
  // This method credits seller/rider internal wallet balances in the DB.
  // Actual cashout only happens when the seller/rider taps "Withdraw" in the app.
  private async triggerPayoutFlow(order: any, payFor: 'seller' | 'rider' | 'both' = 'both') {
    try {
      const latest = await this.orderModel.findById(order._id).exec();
      if (!latest) throw new NotFoundException('Order not found for wallet credit');
      order = latest;

      if (order.payment?.status !== PaymentStatus.PAID) {
        throw new Error(`Cannot credit wallets for unpaid order ${order.orderNumber}`);
      }
      if (order.refund?.status === 'refunded' || order.settlement?.status === 'refunded') {
        this.logger.warn(`Skipping wallet credit for refunded order ${order.orderNumber}`);
        return;
      }
      if (order.dispute?.isDisputed && !order.dispute?.resolvedAt) {
        await this.updateSettlementState(order._id, {
          'settlement.status': 'release_pending',
          'settlement.payoutBlockedReason': 'Active buyer dispute',
        });
        throw new Error(`Cannot credit wallets for disputed order ${order.orderNumber}`);
      }
      if (order.settlement?.status === 'settled') {
        this.logger.log(`Skipping duplicate wallet credit for order ${order.orderNumber}`);
        return;
      }

      const shouldPaySeller = payFor === 'seller' || payFor === 'both';
      const shouldPayRider  = payFor === 'rider'  || payFor === 'both';

      const subtotal            = Number(order.financials?.subtotal || 0);
      const deliveryFee         = Number(order.financials?.deliveryFee || 0);
      const platformCommission  = Math.round(Number(order.financials?.platformCommission ?? Math.max(subtotal * 0.015, 100)));
      const sellerCredit        = Math.max(0, Math.round(Number(order.financials?.sellerPayout ?? (subtotal - platformCommission))));
      const riderCredit         = Math.max(0, Math.round(Number(order.financials?.riderPayout  ?? (deliveryFee * 0.9))));

      const walletServiceUrl = process.env.WALLET_SERVICE_URL || 'http://localhost:3007/api/v1';
      const secret = process.env.INTERNAL_SERVICE_SECRET;
      const headers = secret ? { 'x-internal-service-key': secret } : {};

      // ── Credit seller wallet ──
      if (shouldPaySeller && sellerCredit > 0) {
        const sellerTarget = await this.getSellerSettlementTarget(order);
        if (!sellerTarget.userId) {
          await this.updateSettlementState(order._id, {
            'settlement.sellerStatus': 'failed',
            'settlement.lastError': 'Seller userId missing for wallet credit',
          });
          throw new Error(`Cannot credit seller wallet for order ${order._id}: seller userId missing`);
        }

        await axios.post(`${walletServiceUrl}/wallets/internal/credit`, {
          userId:      sellerTarget.userId,
          role:        'SELLER',
          amount:      sellerCredit,
          orderId:     String(order._id),
          orderNumber: order.orderNumber,
          description: `Earnings from order ${order.orderNumber}`,
        }, { headers });

        await this.updateSettlementState(order._id, {
          'settlement.sellerStatus': 'credited',
        });
        this.logger.log(`[Wallet] Seller wallet credited ${sellerCredit} RWF for order ${order.orderNumber}`);
      }

      // ── Credit rider wallet ──
      if (shouldPayRider && riderCredit > 0) {
        const riderTarget = await this.getRiderSettlementTarget(order);
        if (!riderTarget.userId) {
          await this.updateSettlementState(order._id, {
            'settlement.riderStatus': 'pending_rider_assignment',
            'settlement.status': shouldPaySeller ? 'partial' : 'pending',
          });
          this.logger.warn(`Rider wallet credit pending until rider is assigned to order ${order._id}`);
          return;
        }

        await axios.post(`${walletServiceUrl}/wallets/internal/credit`, {
          userId:      riderTarget.userId,
          role:        'RIDER',
          amount:      riderCredit,
          orderId:     String(order._id),
          orderNumber: order.orderNumber,
          description: `Delivery earnings from order ${order.orderNumber}`,
        }, { headers });

        await this.updateSettlementState(order._id, {
          'settlement.riderStatus': 'credited',
        });
        this.logger.log(`[Wallet] Rider wallet credited ${riderCredit} RWF for order ${order.orderNumber}`);
      }

      // ── Mark settlement complete ──
      await this.updateSettlementState(order._id, {
        'settlement.status': 'settled',
        'settlement.releaseTriggeredAt': order.settlement?.releaseTriggeredAt || new Date(),
        'settlement.payoutBlockedReason': null,
        'settlement.lastError': null,
      });
      this.logger.log(`[Wallet] Wallet credits (${payFor}) completed for order ${order.orderNumber}`);
    } catch (err: any) {
      this.logger.error(`Wallet credit flow error: ${err.message}`);
      throw err;
    }
  }

  async processPaymentCallback(orderNumber: string, status: PaymentStatus, transactionRef: string): Promise<any> {
    const order = await this.orderModel.findOne({ orderNumber });
    if (!order) throw new NotFoundException('Order not found');

    if (order.payment?.status === status) {
      this.logger.log(`Ignoring duplicate payment callback for ${orderNumber}; payment is already ${status}.`);
      return order;
    }

    this.validateTransition(order.payment.status, status, PAYMENT_TRANSITIONS);

    // F004: Payment replay check
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
      if (!ORDER_TRANSITIONS[order.status]?.includes(OrderStatus.CONFIRMED)) {
        this.logger.warn(
          `Ignoring paid callback for ${orderNumber}: order is ${order.status} and cannot be confirmed before quote acceptance.`
        );
        return this.orderModel.findOneAndUpdate(
          { orderNumber },
          {
            $set: {
              'payment.status': PaymentStatus.FAILED,
              'payment.transactionRef': transactionRef
            },
            $push: {
              paymentAttempts: {
                method: order.payment.method,
                transactionRef,
                status: 'ignored_invalid_order_state',
                attemptedAt: new Date(),
                failureReason: `Order status ${order.status} cannot transition to ${OrderStatus.CONFIRMED}`
              }
            }
          },
          { new: true }
        );
      }
      updates['payment.paidAt'] = new Date();
      updates['settlement.status'] = 'escrow_held';
      updates['settlement.sellerStatus'] = 'pending';
      updates['settlement.riderStatus'] = 'pending';
      updates['settlement.platformStatus'] = 'pending';
      updates['settlement.lastError'] = null;
      updates['settlement.updatedAt'] = new Date();
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

      this.buyerProtection.seedReserveFromCommission(
        this.normalizeId(updated._id)!,
        updated.financials || {}
      ).catch(err => {
        this.logger.warn(`Failed to record BPF reserve contribution for order ${orderNumber}: ${err.message}`);
      });

      this.logger.log(`Payment captured for ${orderNumber}; funds are held in escrow until delivery confirmation.`);
    }

    return updated;
  }

  async processPaymentCallbackByReference(
    status: PaymentStatus,
    transactionRef: string,
    orderNumber?: string,
  ): Promise<any> {
    const cleanRef = String(transactionRef || '').replace(/^PAYPACK:/, '');
    const candidateRefs = Array.from(new Set([
      transactionRef,
      cleanRef,
      cleanRef ? `PAYPACK:${cleanRef}` : '',
    ].filter(Boolean)));

    let order = orderNumber ? await this.orderModel.findOne({ orderNumber }) : null;
    if (!order) {
      order = await this.orderModel.findOne({ 'payment.transactionRef': { $in: candidateRefs } });
    }
    if (!order) throw new NotFoundException('Order not found for payment reference');

    const storedRef = order.payment?.transactionRef && candidateRefs.includes(order.payment.transactionRef)
      ? order.payment.transactionRef
      : transactionRef;

    return this.processPaymentCallback(order.orderNumber, status, storedRef);
  }

  private async decrementProductStock(order: any) {
    const productUrl = process.env.PRODUCT_SERVICE_URL || 'http://localhost:3003/api/v1';
    const products = order.products || (order.product ? [order.product] : []);
    const secret = process.env.INTERNAL_SERVICE_SECRET;
    const headers = secret ? { 'x-internal-service-key': secret } : {};

    for (const item of products) {
      try {
        await axios.post(`${productUrl}/products/${item.productId}/stock`, {
          change: -item.quantity
        }, { headers });
        this.logger.log(`Decremented stock for product ${item.productId} by ${item.quantity}`);
      } catch (error) {
        this.logger.error(`Stock update failed for product ${item.productId}: ${error.response?.data?.message || error.message}`);
      }
    }
  }

  private async incrementProductStock(order: any) {
    const productUrl = process.env.PRODUCT_SERVICE_URL || 'http://localhost:3003/api/v1';
    const products = order.products || (order.product ? [order.product] : []);
    const secret = process.env.INTERNAL_SERVICE_SECRET;
    const headers = secret ? { 'x-internal-service-key': secret } : {};

    for (const item of products) {
      try {
        await axios.post(`${productUrl}/products/${item.productId}/stock`, {
          change: item.quantity
        }, { headers });
        this.logger.log(`Restored stock for product ${item.productId} by ${item.quantity} (Order Cancelled)`);
      } catch (error) {
        this.logger.error(`Stock restoration failed for product ${item.productId}: ${error.response?.data?.message || error.message}`);
      }
    }
  }

  private async incrementProductOrders(order: any) {
    const productUrl = process.env.PRODUCT_SERVICE_URL || 'http://localhost:3003/api/v1';
    const products = order.products || (order.product ? [order.product] : []);
    const secret = process.env.INTERNAL_SERVICE_SECRET;
    const headers = secret ? { 'x-internal-service-key': secret } : {};

    for (const item of products) {
      try {
        await axios.post(`${productUrl}/products/${item.productId}/orders/increment`, {
          count: item.quantity || 1
        }, { headers });
      } catch (error: any) {
        this.logger.error(`Failed to increment product orders for ${item.productId}: ${error.response?.data?.message || error.message}`);
      }
    }
  }

  private async createDeliveryForOrder(order: any): Promise<void> {
    const orderNumber = order.orderNumber;
    this.logger.log(`Order ${orderNumber} PAID. Triggering delivery-service...`);
    try {
      const deliveryUrl = process.env.DELIVERY_SERVICE_URL || 'http://localhost:3008/api/v1';
      this.logger.log(`Attempting to create delivery at ${deliveryUrl}/deliveries`);
      const secret = process.env.INTERNAL_SERVICE_SECRET;
      const headers = secret ? { 'x-internal-service-key': secret } : {};

      const seller = order.seller || {};
      const buyer = order.buyer || {};

      // Resolve market coordinates for accurate pickup location via Market Service
      let pickupCoords = { lat: -1.9441, lng: 30.0619 }; // fallback to Kigali center
      try {
        const marketUrl = process.env.MARKET_SERVICE_URL || 'http://localhost:3002/api/v1';
        const { data: market } = await axios.get(`${marketUrl}/markets/${seller.marketId}`, { headers });
        if (market?.location?.coordinates) {
          pickupCoords = { lat: market.location.coordinates[1], lng: market.location.coordinates[0] };
        }
      } catch (err) {
        this.logger.warn(`Could not fetch market coordinates for ${seller.marketId}, using default. Error: ${err.message}`);
      }

      const dropoffAddress = buyer.deliveryAddress || {};
      const plainOrder = await this.orderModel.findById(order._id).lean().exec();

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
          deliveryFee: plainOrder?.financials?.deliveryFee ?? order.financials?.deliveryFee ?? 500,
          totalAmount: plainOrder?.financials?.totalAmount ?? order.financials?.totalAmount ?? 0
        },
        notes: order.notes
      }, { headers });

      const deliveryId = response.data?.data?._id;
      if (deliveryId) {
        await this.orderModel.findByIdAndUpdate(order._id, { deliveryId });
      }

      this.logger.log(`Delivery created successfully for order ${orderNumber}`);
    } catch (error: any) {
      this.logger.error(`Failed to create delivery for order ${orderNumber}`, error.response?.data || error.message);
    }
  }

  async ensureDeliveryForOrder(id: string, userId: string, role?: string): Promise<any> {
    const order = await this.orderModel.findById(id);
    if (!order) throw new NotFoundException('Order not found');

    const normalizedRole = String(role || '').toUpperCase();
    const canManageDispatch = this.isOrderSeller(order, userId) || normalizedRole === 'ADMIN' || userId === 'system' || userId === 'internal-service';
    if (!canManageDispatch) {
      throw new BadRequestException('You do not have permission to start rider dispatch for this order');
    }

    if (order.status !== OrderStatus.READY_FOR_PICKUP) {
      throw new BadRequestException('Rider dispatch can only start after the order is ready for pickup');
    }

    if (!order.deliveryId) {
      await this.createDeliveryForOrder(order);
    }

    return this.orderModel.findById(id).exec();
  }

  async raiseDispute(id: string, reason: string, evidenceUrls: string[] = []): Promise<any> {
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
    this.clearEscrowReleaseTimer(order._id);

    return await this.orderModel.findByIdAndUpdate(
      id,
      {
        $set: {
          status: OrderStatus.DISPUTED,
          'dispute.isDisputed': true,
          'dispute.reason': reason,
          'dispute.evidenceUrls': evidenceUrls.slice(0, 8),
          'dispute.raisedAt': new Date(),
          'settlement.status': 'release_pending',
          'settlement.payoutBlockedReason': 'Active buyer dispute',
          'settlement.updatedAt': new Date(),
        }
      },
      { new: true }
    );
  }

  async resolveDispute(id: string, resolution: DisputeResolution): Promise<any> {
    const order = await this.orderModel.findById(id);
    if (!order) throw new NotFoundException('Order not found');

    this.validateTransition(order.status, OrderStatus.RESOLVED, ORDER_TRANSITIONS);

    let refundResult: any = null;
    if (resolution === DisputeResolution.REFUND) {
      await this.orderModel.findByIdAndUpdate(id, {
        $set: {
          'refund.status': 'pending',
          'refund.amount': order.financials.totalAmount,
          'refund.reason': `Dispute resolution: ${resolution}`,
          'refund.requestedAt': new Date(),
          'settlement.payoutBlockedReason': 'Refund is being processed',
        },
      }).exec();
      try {
        refundResult = await this.buyerProtection.executeInstantRefund(
          order,
          order.financials.totalAmount,
          `Dispute resolution refund for order ${order.orderNumber || id}`
        );
      } catch (error: any) {
        await this.orderModel.findByIdAndUpdate(id, {
          $set: {
            'refund.status': 'failed',
            'refund.error': error.message || 'Refund failed',
            'settlement.status': 'release_pending',
            'settlement.payoutBlockedReason': 'Refund failed and needs admin review',
          },
        }).exec();
        throw error;
      }
    }

    const updated = await this.orderModel.findByIdAndUpdate(
      id,
      {
        $set: {
          status: OrderStatus.RESOLVED,
          'dispute.resolvedAt': new Date(),
          'dispute.resolution': resolution,
          ...(resolution === DisputeResolution.REFUND ? {
            'payment.status': PaymentStatus.REFUNDED,
            'settlement.status': 'refunded',
            'settlement.payoutBlockedReason': null,
            'refund.status': 'refunded',
            'refund.amount': order.financials.totalAmount,
            'refund.transactionRef': refundResult?.transactionRef,
            'refund.reason': `Dispute resolution: ${resolution}`,
            'refund.refundedAt': new Date(),
          } : {
            'settlement.payoutBlockedReason': resolution === DisputeResolution.REDELIVER ? 'Awaiting redelivery completion' : null,
          })
        }
      },
      { new: true }
    );

    if (resolution === DisputeResolution.REJECT && updated) {
      await this.prepareEscrowRelease(updated).catch(err => {
        this.logger.error(`Failed to release escrow after dispute rejection for order ${id}: ${err.message}`);
      });
    }

    return updated;
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
    if (userId && !this.isOrderBuyer(order, userId)) {
      throw new BadRequestException('Only the buyer can retry payment');
    }

    // Only allow retry if payment is in FAILED or PENDING state
    if (order.payment?.status !== PaymentStatus.FAILED && order.payment?.status !== PaymentStatus.PENDING) {
      throw new BadRequestException(`Cannot retry payment for order in ${order.payment?.status} state`);
    }

    if (order.status !== OrderStatus.PLACED) {
      throw new BadRequestException('Payment can only be started after the quote is accepted and the order is placed');
    }

    // CRITICAL: Auto-confirm must NEVER activate in production
    const isNotProduction = process.env.NODE_ENV !== 'production';
    const shouldAutoConfirmPayments = isNotProduction && process.env.AUTO_CONFIRM_PAYMENTS === 'true';

    (order as any)._paypackRetryNonce = uuidv4();
    const paymentResult = await this.paymentService.requestPaymentPrompt(order);
    if (!paymentResult.success) {
      await this.orderModel.findByIdAndUpdate(id, {
        $push: {
          paymentAttempts: {
            method: order.payment?.method,
            status: PaymentStatus.FAILED,
            attemptedAt: new Date(),
            failureReason: paymentResult.error || 'Could not reach payment provider',
          }
        },
        $set: {
          'payment.status': PaymentStatus.FAILED,
          'payment.errorMessage': paymentResult.error || 'Could not reach payment provider',
        }
      });

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
          'payment.errorMessage': null,
        },
        $push: {
          paymentAttempts: {
            method: order.payment?.method,
            transactionRef: paymentResult.transactionId,
            status: PaymentStatus.PENDING,
            attemptedAt: new Date(),
          }
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
    const maxAttempts = process.env.NODE_ENV !== 'production' ? 6 : 120; // 30s in dev, 10 min in prod
    const isNotProduction = process.env.NODE_ENV !== 'production';
    const shouldAutoConfirm = isNotProduction && (
      process.env.MTN_MOMO_TARGET_ENV === 'sandbox' ||
      process.env.PAYPACK_AUTO_CONFIRM === 'true'
    );

    const order = await this.orderModel.findOne({ orderNumber }).exec();
    const paymentMethod = order?.payment?.method || 'MTN_MOMO';

    const poll = setInterval(async () => {
      try {
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
      } catch (error: any) {
        this.logger.error(`Payment polling error for ${orderNumber}: ${error.message}`, error.stack);
        if (error?.code === 'STATE_CONFLICT' || attempts >= maxAttempts) {
          clearInterval(poll);
          this.paymentPollingIntervals.delete(orderNumber);
        }
      }
    }, 5000);

    // Track interval for cleanup on module destroy
    this.paymentPollingIntervals.set(orderNumber, poll);
  }

  async findAll(query: any): Promise<any> {
    const { sellerId, sellerUserId, buyerId, riderUserId, status, isDisputed, 'dispute.resolvedAt': resolvedAt } = query;
    const filter: any = {};
    if (sellerUserId && sellerUserId !== 'all') filter['seller.userId'] = sellerUserId;
    if (sellerId && sellerId !== 'all') {
      filter.$or = [
        { 'seller.userId': sellerId },
        { 'seller.sellerId': sellerId },
      ];
    }
    if (buyerId && buyerId !== 'all') filter['buyer.userId'] = buyerId;
    if (riderUserId && riderUserId !== 'all') filter['rider.userId'] = riderUserId;
    
    if (status && status !== 'all') {
      const statusArray = typeof status === 'string' 
        ? status.split(',') 
        : (Array.isArray(status) ? status : [status]);
      filter.status = { $in: statusArray };
    }
    
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

  async sendQuote(id: string, financials: any, userId: string, options: { allowAdminOverride?: boolean } = {}): Promise<any> {
    const order = await this.orderModel.findById(id);
    if (!order) throw new NotFoundException('Order not found');

    // Authorization: only the seller of this order can send a quote
    if (!options.allowAdminOverride && !this.isOrderSeller(order, userId)) {
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

    const quoteActorId = options.allowAdminOverride
      ? this.normalizeId(order.seller?.userId || order.sellerUserId || userId) || userId
      : userId;

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
            changedBy: quoteActorId,
            changedAt: new Date(),
            note: options.allowAdminOverride ? `Admin sent seller-side quote: ${subtotal} RWF` : `Artisan sent a quote: ${subtotal} RWF`
          },
          messages: {
            senderId: quoteActorId,
            senderRole: 'SELLER',
            channel: 'ORDER',
            recipientRole: 'BUYER',
            type: 'QUOTE',
            content: financials.note || (options.allowAdminOverride ? `A quote has been sent for ${subtotal.toLocaleString()} RWF` : `I have sent a quote for ${subtotal.toLocaleString()} RWF`),
            quoteAmount: subtotal,
            timestamp: new Date()
          }
        }
      },
      { returnDocument: 'after' }
    );

    if (updated) {
      const lastMsg = updated.messages[updated.messages.length - 1];
      const plainOrder = updated.toObject ? updated.toObject() : updated;
      this.orderGateway.sendOrderUpdate({
        type: 'NEW_MESSAGE',
        orderId: id,
        message: lastMsg,
        status: OrderStatus.QUOTE_SENT
      });
      await this.notifyOrderMessageParticipants(plainOrder, id, lastMsg);
      this.orderGateway.sendOrderUpdate({ type: 'STATUS_UPDATE', orderId: id, status: OrderStatus.QUOTE_SENT });

      // Notify Buyer about new Quote
      this.triggerNotification(updated.buyer.userId, 'quote.sent', { 
        orderNumber: updated.orderNumber, 
        orderId: id,
        amount: subtotal
      });
    }

    return updated;
  }

  async counterOffer(id: string, subtotal: number, note: string | undefined, userId: string): Promise<any> {
    const order = await this.orderModel.findById(id);
    if (!order) throw new NotFoundException('Order not found');

    // Authorization: only the buyer of this order can send a counter-offer
    if (!this.isOrderBuyer(order, userId)) {
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
            channel: 'ORDER',
            recipientRole: 'SELLER',
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
      const plainOrder = updated.toObject ? updated.toObject() : updated;
      this.orderGateway.sendOrderUpdate({
        type: 'NEW_MESSAGE',
        orderId: id,
        message: lastMsg,
        status: OrderStatus.AWAITING_QUOTE
      });
      await this.notifyOrderMessageParticipants(plainOrder, id, lastMsg);
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
    if (!this.isOrderBuyer(order, userId)) {
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
            channel: 'ORDER',
            recipientRole: 'SELLER',
            type: 'TEXT',
            content: reason || 'I have decided to decline this quote. Thank you.',
            timestamp: new Date()
          }
        }
      },
      { returnDocument: 'after' }
    );

    if (updated) {
      const lastMsg = updated.messages[updated.messages.length - 1];
      const plainOrder = updated.toObject ? updated.toObject() : updated;
      this.orderGateway.sendOrderUpdate({
        type: 'NEW_MESSAGE',
        orderId: id,
        message: lastMsg,
        status: OrderStatus.CANCELLED
      });
      await this.notifyOrderMessageParticipants(plainOrder, id, lastMsg);
      this.orderGateway.sendOrderUpdate({ type: 'STATUS_UPDATE', orderId: id, status: OrderStatus.CANCELLED });
    }

    return updated;
  }

  async addMessage(
    id: string,
    messageData: {
      senderId: string;
      senderRole: string;
      content: string;
      imageUrl?: string;
      channel?: string;
      recipientRole?: string;
      type?: string;
      quoteAmount?: number;
    },
    authenticatedUserId: string,
    authenticatedRole: string
  ): Promise<any> {
    this.logger.log(`Adding message to order ${id} from ${messageData.senderRole}`);
    try {
      const order = await this.orderModel.findById(id).exec();
      if (!order) throw new NotFoundException('Order not found');
      if ([OrderStatus.DELIVERED, OrderStatus.RESOLVED, OrderStatus.CANCELLED].includes(order.status)) {
        throw new BadRequestException('This order is closed. Messages are locked.');
      }

      const role = String(authenticatedRole || '').toUpperCase();
      const isBuyer = this.isOrderBuyer(order, authenticatedUserId);
      const isSeller = this.isOrderSeller(order, authenticatedUserId);
      const isRider = role === 'RIDER';
      const isAdmin = role === 'ADMIN';
      if (!isBuyer && !isSeller && !isRider && !isAdmin) {
        throw new BadRequestException('You are not a participant in this order');
      }

      const senderRole = isAdmin ? 'ADMIN' : isRider ? 'RIDER' : isSeller ? 'SELLER' : 'BUYER';
      if (messageData.senderRole && messageData.senderRole !== senderRole) {
        throw new BadRequestException('Sender role does not match authenticated user');
      }

      const content = String(messageData.content || '').trim() || (messageData.imageUrl ? 'Sent an image' : '');
      if (!content) {
        throw new BadRequestException('Message content or image is required');
      }

      const channel = ['ORDER', 'DELIVERY', 'DISPUTE'].includes(String(messageData.channel || '').toUpperCase())
        ? String(messageData.channel).toUpperCase()
        : senderRole === 'RIDER'
          ? 'DELIVERY'
          : 'ORDER';
      const recipientRole = messageData.recipientRole && ['BUYER', 'SELLER', 'RIDER', 'ADMIN'].includes(String(messageData.recipientRole).toUpperCase())
        ? String(messageData.recipientRole).toUpperCase()
        : undefined;
      const message = {
        senderId: authenticatedUserId,
        senderRole,
        channel,
        recipientRole,
        content,
        imageUrl: messageData.imageUrl,
        type: messageData.type || 'TEXT',
        quoteAmount: messageData.quoteAmount,
        timestamp: new Date()
      };

      const updated = await this.orderModel.findByIdAndUpdate(
        id,
        {
          $push: {
            messages: message
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
          message: lastMessage,
          channel: lastMessage.channel || channel
        });
        await this.notifyOrderMessageParticipants(plainOrder, id, lastMessage);
      }
      return plainOrder;
    } catch (error) {
      this.logger.error(`Error adding message to order ${id}: ${error.message}`, error.stack);
      if (error instanceof NotFoundException) throw error;
      if (error instanceof BadRequestException) throw error;
      throw new BadRequestException('Failed to add message. Check order ID and message format.');
    }
  }

  async updateDeliveryAddress(id: string, address: string, coordinates: { lat: number; lng: number }, userId: string): Promise<any> {
    const order = await this.orderModel.findById(id);
    if (!order) throw new NotFoundException('Order not found');

    // Authorization: only the buyer can update delivery address
    if (!this.isOrderBuyer(order, userId)) {
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
      let marketPoint: { lat: number; lng: number } | null = null;
      const marketId = order.seller?.marketId;

      // Safely query the database ONLY if the marketId is a valid ObjectId, otherwise use slug query or HTTP fallback
      if (marketId && Types.ObjectId.isValid(marketId)) {
        try {
          const market = await this.marketModel.findById(marketId).exec();
          if (market?.location?.coordinates) {
            marketPoint = { lat: market.location.coordinates[1], lng: market.location.coordinates[0] };
          }
        } catch (dbErr: any) {
          this.logger.warn(`Direct DB lookup failed for marketId ${marketId}: ${dbErr.message}`);
        }
      }

      // If we couldn't resolve the marketPoint directly, try lookup by slug in the database
      if (!marketPoint && marketId) {
        try {
          const marketBySlug = await this.marketModel.findOne({ slug: marketId, deletedAt: null }).exec();
          if (marketBySlug?.location?.coordinates) {
            marketPoint = { lat: marketBySlug.location.coordinates[1], lng: marketBySlug.location.coordinates[0] };
          }
        } catch (slugDbErr: any) {
          this.logger.warn(`DB slug lookup failed for ${marketId}: ${slugDbErr.message}`);
        }
      }

      // Finally fallback to HTTP call to market-service
      if (!marketPoint && marketId) {
        try {
          const marketUrl = process.env.MARKET_SERVICE_URL || 'http://localhost:3002/api/v1';
          const secret = process.env.INTERNAL_SERVICE_SECRET;
          const headers = secret ? { 'x-internal-service-key': secret } : {};
          const { data: marketRes } = await axios.get(`${marketUrl}/markets/${marketId}`, { headers });
          const marketData = marketRes?.data || marketRes;
          if (marketData?.location?.coordinates) {
            marketPoint = {
              lat: marketData.location.coordinates[1],
              lng: marketData.location.coordinates[0],
            };
          }
        } catch (httpErr: any) {
          this.logger.warn(`HTTP lookup failed for marketId ${marketId}: ${httpErr.message}`);
        }
      }

      if (marketPoint) {
        // Query delivery-service fee calculation endpoint for exact pricing
        try {
          const deliveryUrl = process.env.DELIVERY_SERVICE_URL || 'http://localhost:3008/api/v1';
          const secret = process.env.INTERNAL_SERVICE_SECRET;
          const headers = secret ? { 'x-internal-service-key': secret } : {};
          const { data: feeRes } = await axios.post(`${deliveryUrl}/deliveries/fee`, {
            from: marketPoint,
            to: coordinates
          }, { headers });
          const feeData = feeRes?.data || feeRes;
          if (feeData?.fee !== undefined) {
            deliveryFee = feeData.fee;
          }
        } catch (feeErr: any) {
          this.logger.warn(`Failed to fetch fee from delivery-service: ${feeErr.message}. Falling back to straight-line...`);
          const dist = this.locationService.calculateDistance(marketPoint, coordinates);
          const feePerBand = Number(process.env.DELIVERY_FEE_PER_5KM) || 500;
          deliveryFee = Math.max(Math.ceil(dist / 5) * feePerBand, feePerBand);
        }
      }
    } catch (err: any) {
      this.logger.warn(`Could not calculate delivery fee from market for order ${id}: ${err.message}`);
    }

    const minimumDeliveryFee = Math.max(Number(process.env.MIN_DELIVERY_FEE_RWF) || 1000, 1000);
    deliveryFee = Math.max(Number(deliveryFee) || 0, minimumDeliveryFee);

    const subtotal = order.financials?.subtotal || 0;
    const platformCommission = order.financials?.platformCommission || Math.max(subtotal * 0.015, 100);
    const gatewayFee = Math.ceil((subtotal + deliveryFee) * 0.02);
    const totalAmount = subtotal + deliveryFee + gatewayFee;
    const riderPayout = Math.ceil(deliveryFee * 0.9);
    const sellerPayout = subtotal - platformCommission;

    const updated = await this.orderModel.findByIdAndUpdate(
      id,
      {
        $set: {
          'buyer.deliveryAddress': { address, coordinates },
          'financials.deliveryFee': deliveryFee,
          'financials.gatewayFee': gatewayFee,
          'financials.totalAmount': totalAmount,
          'financials.riderPayout': riderPayout,
          'financials.sellerPayout': sellerPayout,
        },
        $push: {
          messages: {
            senderId: userId,
            senderRole: 'BUYER',
            channel: 'ORDER',
            recipientRole: 'SELLER',
            type: 'TEXT',
            content: `Delivery location set: ${address}. Delivery fee: ${deliveryFee.toLocaleString()} RWF.`,
            timestamp: new Date()
          }
        }
      },
      { returnDocument: 'after' }
    );

    if (updated) {
      const lastMsg = updated.messages[updated.messages.length - 1];
      const plainOrder = updated.toObject ? updated.toObject() : updated;
      this.orderGateway.sendOrderUpdate({
        type: 'NEW_MESSAGE',
        orderId: id,
        message: lastMsg,
        channel: lastMsg?.channel || 'ORDER'
      });
      await this.notifyOrderMessageParticipants(plainOrder, id, lastMsg);
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

  async updateDeliveryDispatchFee(id: string, deliveryFee: number, searchSurcharge = 0, radiusMeters = 0, userId = 'internal-service'): Promise<any> {
    if (!Number.isFinite(deliveryFee) || deliveryFee < 0) {
      throw new BadRequestException('Delivery fee must be a valid non-negative number');
    }

    const order = await this.orderModel.findById(id);
    if (!order) throw new NotFoundException('Order not found');

    const subtotal = Number(order.financials?.subtotal || 0);
    const platformCommission = Number(order.financials?.platformCommission || Math.max(subtotal * 0.015, 100));
    const gatewayFee = Math.ceil((subtotal + deliveryFee) * 0.02);
    const updatedFinancials = {
      subtotal,
      deliveryFee,
      platformCommission,
      gatewayFee,
      totalAmount: subtotal + deliveryFee + gatewayFee,
      sellerPayout: Number(order.financials?.sellerPayout || subtotal - platformCommission),
      riderPayout: Math.ceil(deliveryFee * 0.9),
    };

    const updated = await this.orderModel.findByIdAndUpdate(
      id,
      {
        $set: {
          financials: updatedFinancials,
          'attributes.dispatchRadiusMeters': String(Math.round(radiusMeters || 0)),
          'attributes.dispatchSearchSurcharge': String(Math.round(searchSurcharge || 0)),
        },
        $push: {
          statusHistory: {
            status: order.status,
            changedBy: /^[0-9a-fA-F]{24}$/.test(String(userId || '')) ? userId : null,
            changedAt: new Date(),
            note: `Adaptive rider search radius ${Math.round(radiusMeters || 0)}m, delivery fee ${deliveryFee} RWF`,
          },
        },
      },
      { returnDocument: 'after' }
    );

    this.orderGateway.sendOrderUpdate({
      type: 'DELIVERY_FEE_UPDATE',
      orderId: id,
      deliveryFee,
      searchSurcharge,
      radiusMeters,
    });

    return updated;
  }

  onModuleDestroy() {
    // Clean up all payment polling intervals to prevent stale callbacks
    for (const [orderNumber, interval] of this.paymentPollingIntervals.entries()) {
      clearInterval(interval);
      this.logger.log(`Cleaned up payment polling for order ${orderNumber}`);
    }
    this.paymentPollingIntervals.clear();
    for (const [orderId, timer] of this.escrowReleaseTimers.entries()) {
      clearTimeout(timer);
      this.logger.log(`Cleaned up escrow release timer for order ${orderId}`);
    }
    this.escrowReleaseTimers.clear();
  }
}
