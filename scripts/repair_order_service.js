const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, '..', 'apps', 'order-service', 'src', 'order', 'order.service.ts');

console.log('Reading file:', filePath);
let content = fs.readFileSync(filePath, 'utf8');

const startAnchor = '  private async incrementProductStock(order: any) {';
const endAnchor = '  async getOrderById(id: string): Promise<any> {';

const startIndex = content.indexOf(startAnchor);
const endIndex = content.indexOf(endAnchor);

if (startIndex === -1) {
  console.error('Could not find start anchor:', startAnchor);
  process.exit(1);
}

if (endIndex === -1) {
  console.error('Could not find end anchor:', endAnchor);
  process.exit(1);
}

console.log(`Found start index at ${startIndex}, end index at ${endIndex}`);

const replacement = `  private async incrementProductStock(order: any) {
    const productUrl = process.env.PRODUCT_SERVICE_URL || 'http://localhost:3003/api/v1';
    const products = order.products || (order.product ? [order.product] : []);
    const secret = process.env.INTERNAL_SERVICE_SECRET;
    const headers = secret ? { 'x-internal-service-key': secret } : {};

    for (const item of products) {
      try {
        await axios.post(\`\${productUrl}/products/\${item.productId}/stock\`, {
          change: item.quantity
        }, { headers });
        this.logger.log(\`Restored stock for product \${item.productId} by \${item.quantity} (Order Cancelled)\`);
      } catch (error) {
        this.logger.error(\`Stock restoration failed for product \${item.productId}: \${error.response?.data?.message || error.message}\`);
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
        await axios.post(\`\${productUrl}/products/\${item.productId}/orders/increment\`, {
          count: item.quantity || 1
        }, { headers });
        this.logger.log(\`Incremented totalOrders for product \${item.productId} by \${item.quantity || 1}\`);
      } catch (error: any) {
        this.logger.error(\`Failed to increment product orders for \${item.productId}: \${error.response?.data?.message || error.message}\`);
      }
    }
  }

  private async createDeliveryForOrder(order: any): Promise<void> {
    const orderNumber = order.orderNumber;
    this.logger.log(\`Order \${orderNumber} PAID. Triggering delivery-service...\`);
    try {
      const deliveryUrl = process.env.DELIVERY_SERVICE_URL || 'http://localhost:3008/api/v1';
      this.logger.log(\`Attempting to create delivery at \${deliveryUrl}/deliveries\`);
      const secret = process.env.INTERNAL_SERVICE_SECRET;
      const headers = secret ? { 'x-internal-service-key': secret } : {};

      const seller = order.seller || {};
      const buyer = order.buyer || {};

      // Resolve market coordinates for accurate pickup location via Market Service
      let pickupCoords = { lat: -1.9441, lng: 30.0619 }; // fallback to Kigali center
      try {
        const marketUrl = process.env.MARKET_SERVICE_URL || 'http://localhost:3002/api/v1';
        const { data: market } = await axios.get(\`\${marketUrl}/markets/\${seller.marketId}\`, { headers });
        if (market?.location?.coordinates) {
          pickupCoords = { lat: market.location.coordinates[1], lng: market.location.coordinates[0] };
        }
      } catch (err) {
        this.logger.warn(\`Could not fetch market coordinates for \${seller.marketId}, using default. Error: \${err.message}\`);
      }

      const dropoffAddress = buyer.deliveryAddress || {};
      const plainOrder = await this.orderModel.findById(order._id).lean().exec();

      const response = await axios.post(\`\${deliveryUrl}/deliveries\`, {
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

      this.logger.log(\`Delivery created successfully for order \${orderNumber}\`);
    } catch (error: any) {
      this.logger.error(\`Failed to create delivery for order \${orderNumber}\`, error.response?.data || error.message);
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
      console.log(\`Instant Refund processed for order \${id} via Buyer Protection Fund (1% pool).\`);
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

`;

const newContent = content.substring(0, startIndex) + replacement + content.substring(endIndex);
fs.writeFileSync(filePath, newContent, 'utf8');
console.log('Successfully repaired order.service.ts!');
