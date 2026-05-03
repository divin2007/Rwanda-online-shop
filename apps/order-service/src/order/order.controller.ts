import { Controller, Get, Post, Put, Body, Param, Query } from '@nestjs/common';
import { OrderService } from './order.service';
import { OrderStatus, PaymentStatus, DisputeResolution } from '@rmf/shared-types';

@Controller('orders')
export class OrderController {
  constructor(private readonly orderService: OrderService) {}

  @Post()
  async createOrder(@Body() orderData: any) {
    const order = await this.orderService.createOrder(orderData);
    return { success: true, data: order };
  }

  @Get()
  async getOrders(@Query() query: any) {
    const orders = await this.orderService.findAll(query);
    return { success: true, data: orders };
  }

  @Get(':id')
  async getOrder(@Param('id') id: string) {
    const order = await this.orderService.getOrderById(id);
    return { success: true, data: order };
  }

  @Put(':id/status')
  async updateStatus(@Param('id') id: string, @Body() body: { status: OrderStatus, userId: string }) {
    const order = await this.orderService.updateOrderStatus(id, body.status, body.userId);
    return { success: true, data: order };
  }

  @Post('payment/callback')
  async paymentCallback(@Body() body: { orderNumber: string, status: PaymentStatus, transactionRef: string }) {
    const order = await this.orderService.processPaymentCallback(body.orderNumber, body.status, body.transactionRef);
    return { success: true, data: order };
  }

  @Post(':id/dispute')
  async raiseDispute(@Param('id') id: string, @Body() body: { reason: string }) {
    const order = await this.orderService.raiseDispute(id, body.reason);
    return { success: true, data: order };
  }

  @Post(':id/resolve')
  async resolveDispute(@Param('id') id: string, @Body() body: { resolution: DisputeResolution }) {
    const order = await this.orderService.resolveDispute(id, body.resolution);
    return { success: true, data: order };
  }
}
