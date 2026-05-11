import { Controller, Get, Post, Put, Body, Param, Query, Req, UseInterceptors, UploadedFile } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { OrderService } from './order.service';
import { OrderStatus, PaymentStatus, DisputeResolution } from '@rmf/shared-types';
import { CreateOrderDto } from './dto/create-order.dto';
import { AddMessageDto } from './dto/add-message.dto';
import { SendQuoteDto } from './dto/send-quote.dto';
import { Public } from '@rmf/auth';

@Controller('orders')
export class OrderController {
  constructor(private readonly orderService: OrderService) {}

  @Post()
  async createOrder(@Body() orderData: CreateOrderDto) {
    const order = await this.orderService.createOrder(orderData as any);
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

  @Public()
  @Put(':id/status')
  async updateStatus(@Param('id') id: string, @Body() body: { status: OrderStatus, userId?: string }, @Req() req: any) {
    const userId = req.user?.userId || body.userId || 'system';
    const order = await this.orderService.updateOrderStatus(id, body.status, userId);
    return { success: true, data: order };
  }

  @Public()
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

  @Post(':id/dispute/resolve')
  async resolveDispute(@Param('id') id: string, @Body() body: { resolution: DisputeResolution }) {
    const order = await this.orderService.resolveDispute(id, body.resolution);
    return { success: true, data: order };
  }

  @Post(':id/retry-payment')
  async retryPayment(@Param('id') id: string, @Req() req: any) {
    const userId = req.user.userId;
    const order = await this.orderService.retryPayment(id, userId);
    return { success: true, data: order };
  }

  @Put(':id/rated')
  async markAsRated(@Param('id') id: string) {
    const order = await this.orderService.markAsRated(id);
    return { success: true, data: order };
  }

  @Post(':id/quote')
  async sendQuote(@Param('id') id: string, @Body() body: SendQuoteDto, @Req() req: any) {
    const userId = req.user.userId;
    const order = await this.orderService.sendQuote(id, body.financials, userId);
    return { success: true, data: order };
  }

  @Post(':id/counter-offer')
  async counterOffer(@Param('id') id: string, @Body() body: { subtotal: number, note?: string }, @Req() req: any) {
    const userId = req.user.userId;
    const order = await this.orderService.counterOffer(id, body.subtotal, body.note, userId);
    return { success: true, data: order };
  }

  @Post(':id/reject-quote')
  async rejectQuote(@Param('id') id: string, @Body() body: { reason?: string }, @Req() req: any) {
    const userId = req.user.userId;
    const order = await this.orderService.rejectQuote(id, body.reason || '', userId);
    return { success: true, data: order };
  }

  @Post(':id/messages')
  async addMessage(@Param('id') id: string, @Body() body: AddMessageDto, @Req() req: any) {
    const userId = req.user.userId;
    const order = await this.orderService.addMessage(id, body, userId);
    return { success: true, data: order };
  }

  @Put(':id/delivery-address')
  async updateDeliveryAddress(@Param('id') id: string, @Body() body: { address: string, coordinates: { lat: number, lng: number } }, @Req() req: any) {
    const userId = req.user.userId;
    const order = await this.orderService.updateDeliveryAddress(id, body.address, body.coordinates, userId);
    return { success: true, data: order };
  }

  @Post('upload-image')
  @UseInterceptors(FileInterceptor('file'))
  async uploadImage(@UploadedFile() file: any) {
    if (!file) {
      return { success: false, message: 'No file uploaded' };
    }

    // In dev, we convert to base64 so the user sees THEIR image immediately
    const base64 = file.buffer.toString('base64');
    const dataUri = `data:${file.mimetype};base64,${base64}`;

    return {
      success: true,
      data: { url: dataUri }
    };
  }
}