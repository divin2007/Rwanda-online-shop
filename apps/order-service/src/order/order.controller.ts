import {
  Body,
  BadRequestException,
  Controller,
  ForbiddenException,
  Get,
  Head,
  Param,
  Patch,
  Post,
  Put,
  Query,
  Req,
  UnauthorizedException,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { Public, JwtAuthGuard } from '@rmf/auth';
import { DisputeResolution, OrderStatus, PaymentStatus, UserRole } from '@rmf/shared-types';
import axios from 'axios';
import * as crypto from 'crypto';
import { existsSync, mkdirSync, writeFileSync } from 'fs';
import { join } from 'path';
import { AddMessageDto } from './dto/add-message.dto';
import { CreateOrderDto } from './dto/create-order.dto';
import { SendQuoteDto } from './dto/send-quote.dto';
import { OrderService } from './order.service';
import { PaymentService } from './payment.service';

/**
 * Verify internal microservice calls via shared secret header.
 * Used for status transitions initiated by delivery-service / payment callbacks.
 */
function verifyInternalOrJwt(req: any): { userId: string; role: string } {
  const authHeader = req.headers?.authorization;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    try {
      const token = authHeader.substring(7);
      const jwt = require('jsonwebtoken');
      if (process.env.NODE_ENV === 'production' && !process.env.JWT_SECRET) {
        throw new Error('JWT_SECRET is not configured');
      }
      const jwtSecret = process.env.JWT_SECRET || 'dev-secret-change-in-prod';
      const decoded = jwt.verify(token, jwtSecret);
      const userId = decoded?.sub || decoded?.userId || decoded?.id;
      if (userId) return { userId: String(userId), role: String(decoded?.role || '').toUpperCase() };
    } catch {
      // Fall through to internal secret check.
    }
  }

  const secret = process.env.INTERNAL_SERVICE_SECRET;
  if (secret) {
    const provided = req.headers?.['x-internal-service-key'] || req.headers?.['x-internal-secret'];
    if (provided === secret) return { userId: 'internal-service', role: 'INTERNAL' };
  }

  throw new UnauthorizedException('Valid JWT or internal service key required');
}

function verifyInternalService(req: any): string {
  const secret = process.env.INTERNAL_SERVICE_SECRET;
  if (!secret) {
    throw new UnauthorizedException('INTERNAL_SERVICE_SECRET must be configured for internal order-service mutations');
  }

  const provided = req.headers?.['x-internal-service-key'] || req.headers?.['x-internal-secret'];
  if (provided !== secret) {
    throw new UnauthorizedException('Valid internal service key required');
  }

  return 'internal-service';
}

@UseGuards(JwtAuthGuard)
@Controller('orders')
export class OrderController {
  constructor(
    private readonly orderService: OrderService,
    private readonly paymentService: PaymentService,
  ) {}

  private normalizeId(value: any): string | undefined {
    if (value === null || value === undefined) return undefined;
    if (typeof value === 'string') return value;
    if (typeof value === 'number') return String(value);
    if (typeof value.toHexString === 'function') return value.toHexString();
    if (value._id !== undefined && value._id !== value) return this.normalizeId(value._id);
    if (value.id !== undefined && value.id !== value) return this.normalizeId(value.id);
    return String(value);
  }

  private requestUserId(req: any): string {
    const userId = this.normalizeId(req.user?.userId || req.user?.id || req.user?.sub || req.user?._id);
    if (!userId) {
      throw new UnauthorizedException('Authenticated user id is missing');
    }
    return userId;
  }

  private idsMatch(left: any, right: any): boolean {
    const leftId = this.normalizeId(left);
    const rightId = this.normalizeId(right);
    return Boolean(leftId && rightId && leftId === rightId);
  }

  private isAdmin(req: any): boolean {
    return String(req.user?.role || '').toUpperCase() === UserRole.ADMIN;
  }

  private isBuyer(order: any, req: any): boolean {
    try {
      const userId = this.requestUserId(req);
      const buyerId = this.normalizeId(order?.buyer?.userId || order?.buyerId);
      return Boolean(userId && buyerId && userId.toLowerCase() === buyerId.toLowerCase());
    } catch {
      return false;
    }
  }

  private isSeller(order: any, req: any): boolean {
    try {
      const userId = this.requestUserId(req);
      const sellerId = this.normalizeId(order?.seller?.userId || order?.sellerUserId);
      return Boolean(userId && sellerId && userId.toLowerCase() === sellerId.toLowerCase());
    } catch {
      return false;
    }
  }

  private async isAssignedRider(order: any, req: any): Promise<boolean> {
    try {
      if (String(req.user?.role || '').toUpperCase() !== UserRole.RIDER) return false;
      const userId = this.requestUserId(req);
      const deliveryId = this.normalizeId(order?.deliveryId);
      if (!userId || !deliveryId) return false;

      const deliveryUrl = process.env.DELIVERY_SERVICE_URL || 'http://localhost:3008/api/v1';
      const secret = process.env.INTERNAL_SERVICE_SECRET;
      const headers = secret ? { 'x-internal-service-key': secret } : {};
      const response = await axios.get(`${deliveryUrl}/deliveries/${deliveryId}`, { headers, timeout: 2500 });
      const delivery = response.data?.data || response.data;
      const riderUserId = this.normalizeId(delivery?.rider?.userId);
      return Boolean(riderUserId && riderUserId.toLowerCase() === userId.toLowerCase());
    } catch {
      return false;
    }
  }

  private async assertParticipant(order: any, req: any) {
    if (!this.isAdmin(req) && !this.isBuyer(order, req) && !this.isSeller(order, req) && !(await this.isAssignedRider(order, req))) {
      throw new ForbiddenException('You can only view your own orders');
    }
  }

  private assertBuyer(order: any, req: any, message: string) {
    if (!this.isAdmin(req) && !this.isBuyer(order, req)) {
      throw new ForbiddenException(message);
    }
  }

  @Post()
  async createOrder(@Body() orderData: CreateOrderDto, @Req() req: any) {
    if (String(req.user.role).toUpperCase() !== UserRole.BUYER) {
      throw new ForbiddenException('Only buyer accounts can place orders or start negotiations');
    }

    (orderData as any).buyer = (orderData as any).buyer || {};
    (orderData as any).buyer.userId = this.requestUserId(req);
    const order = await this.orderService.createOrder(orderData as any);
    return { success: true, data: order };
  }

  @Public()
  @Get('public/stats')
  async getPublicStats() {
    const stats = await this.orderService.getPublicStats();
    return { success: true, data: stats };
  }

  @Get()
  async getOrders(@Query() query: any, @Req() req: any) {
    const scopedQuery = { ...query };
    const role = String(req.user.role || '').toUpperCase();
    const userId = this.requestUserId(req);

    if (role !== UserRole.ADMIN) {
      if (role === UserRole.SELLER) {
        scopedQuery.sellerUserId = userId;
      } else if (role === UserRole.RIDER) {
        scopedQuery.riderUserId = userId;
      } else {
        scopedQuery.buyerId = userId;
      }
    }

    const orders = await this.orderService.findAll(scopedQuery);
    return { success: true, data: orders };
  }

  @Public()
  @Get('payment/paypack/readiness')
  paypackReadiness() {
    return { success: true, data: this.paymentService.getPaypackReadiness() };
  }

  @Get(':id')
  async getOrder(@Param('id') id: string, @Req() req: any) {
    const order = await this.orderService.getOrderById(id);
    await this.assertParticipant(order, req);
    return { success: true, data: order };
  }

  @Public()
  @Put(':id/status')
  async updateStatus(@Param('id') id: string, @Body() body: { status: OrderStatus; userId?: string }, @Req() req: any) {
    const actor = verifyInternalOrJwt(req);
    const order = await this.orderService.updateOrderStatus(id, body.status, actor.userId, actor.role);
    return { success: true, data: order };
  }

  @Post(':id/delivery/ensure')
  async ensureDelivery(@Param('id') id: string, @Req() req: any) {
    const order = await this.orderService.ensureDeliveryForOrder(id, this.requestUserId(req), String(req.user.role || '').toUpperCase());
    return { success: true, data: order };
  }

  @Public()
  @Post('payment/callback')
  async paymentCallback(@Body() body: { orderNumber: string; status: PaymentStatus; transactionRef: string }, @Req() req: any) {
    this.isValidWebhook(req, body);
    const order = await this.orderService.processPaymentCallback(body.orderNumber, body.status, body.transactionRef);
    return { success: true, data: order };
  }

  @Public()
  @Head('payment/paypack/callback')
  paypackWebhookHealthcheck() {
    return;
  }

  @Public()
  @Post('payment/paypack/callback')
  async paypackPaymentCallback(@Body() body: any, @Req() req: any) {
    const isValid = this.paymentService.verifyPaypackWebhook(body, req.headers || {}, req.rawBody);
    if (!isValid) {
      throw new UnauthorizedException('Invalid Paypack webhook signature');
    }

    let event;
    try {
      event = this.paymentService.parsePaypackWebhook(body);
    } catch (error: any) {
      throw new BadRequestException(error.message || 'Invalid Paypack webhook payload');
    }

    const status = event.status === 'SUCCESSFUL'
      ? PaymentStatus.PAID
      : event.status === 'FAILED'
        ? PaymentStatus.FAILED
        : PaymentStatus.PENDING;

    const order = await this.orderService.processPaymentCallbackByReference(
      status,
      event.transactionRef,
      event.orderNumber,
    );

    return { success: true, data: order };
  }

  private isValidWebhook(req: any, body: any): boolean {
    const mtnSignature = req.headers['x-mtn-signature'];
    const airtelSignature = req.headers['x-airtel-signature'];
    const internalSecret = req.headers['x-internal-secret'] || req.headers['x-internal-service-key'];

    const expectedInternalSecret = process.env.INTERNAL_SERVICE_SECRET;

    if (expectedInternalSecret && internalSecret === expectedInternalSecret) {
      return true;
    }

    // Fail closed: with the known dev fallback secret anyone could forge a paid callback.
    if (process.env.NODE_ENV === 'production' && !process.env.PAYMENT_WEBHOOK_SECRET) {
      throw new UnauthorizedException('Payment webhook secret is not configured');
    }
    const webhookSecret = process.env.PAYMENT_WEBHOOK_SECRET || 'dev-webhook-secret';

    const signature = mtnSignature || airtelSignature;
    if (!signature) {
      throw new UnauthorizedException('Missing signature headers (X-MTN-Signature or X-Airtel-Signature)');
    }

    const rawBody = JSON.stringify(body);
    const sortedRawBody = JSON.stringify(
      Object.keys(body)
        .sort()
        .reduce((acc: any, key: string) => {
          acc[key] = body[key];
          return acc;
        }, {}),
    );

    const isMtnValid =
      this.verifyHmacSignature(rawBody, signature, webhookSecret) ||
      this.verifyHmacSignature(sortedRawBody, signature, webhookSecret);

    const mtnSecret = process.env.MTN_MOMO_WEBHOOK_SECRET;
    const airtelSecret = process.env.AIRTEL_MONEY_WEBHOOK_SECRET;

    const isMtnSpecificValid =
      mtnSecret &&
      (this.verifyHmacSignature(rawBody, signature, mtnSecret) ||
        this.verifyHmacSignature(sortedRawBody, signature, mtnSecret));

    const isAirtelSpecificValid =
      airtelSecret &&
      (this.verifyHmacSignature(rawBody, signature, airtelSecret) ||
        this.verifyHmacSignature(sortedRawBody, signature, airtelSecret));

    if (isMtnValid || isMtnSpecificValid || isAirtelSpecificValid) {
      return true;
    }

    throw new UnauthorizedException('Invalid payment webhook signature verification failed');
  }

  private verifyHmacSignature(rawBody: string, signature: string, secret: string): boolean {
    const computed = crypto.createHmac('sha256', secret).update(rawBody).digest('hex');
    const computedBase64 = crypto.createHmac('sha256', secret).update(rawBody).digest('base64');
    const isBase64 = signature.includes('=') || signature.length === 44;

    try {
      const sigBuffer = Buffer.from(signature, isBase64 ? 'base64' : 'hex');
      const compBuffer = Buffer.from(isBase64 ? computedBase64 : computed, isBase64 ? 'base64' : 'hex');
      return sigBuffer.length === compBuffer.length && crypto.timingSafeEqual(sigBuffer, compBuffer);
    } catch {
      return false;
    }
  }

  @Post(':id/dispute')
  async raiseDispute(@Param('id') id: string, @Body() body: { reason: string; evidenceUrls?: string[] }, @Req() req: any) {
    if (String(req.user.role).toUpperCase() !== UserRole.BUYER && !this.isAdmin(req)) {
      throw new ForbiddenException('Only buyer accounts can raise disputes');
    }

    const order = await this.orderService.getOrderById(id);
    this.assertBuyer(order, req, 'Only the buyer can raise a dispute');
    const updated = await this.orderService.raiseDispute(id, body.reason, Array.isArray(body.evidenceUrls) ? body.evidenceUrls : []);
    return { success: true, data: updated };
  }

  @Post(':id/dispute/resolve')
  async resolveDispute(@Param('id') id: string, @Body() body: { resolution: DisputeResolution | string }, @Req() req: any) {
    if (!this.isAdmin(req)) {
      throw new ForbiddenException('Only an ADMIN can resolve disputes');
    }
    const resolutionMap: Record<string, DisputeResolution> = {
      REFUND: DisputeResolution.REFUND,
      refund: DisputeResolution.REFUND,
      REDELIVER: DisputeResolution.REDELIVER,
      redeliver: DisputeResolution.REDELIVER,
      PARTIAL: DisputeResolution.REDELIVER,
      NO_REFUND: DisputeResolution.REJECT,
      REJECT: DisputeResolution.REJECT,
      reject: DisputeResolution.REJECT,
    };
    const resolution = resolutionMap[String(body.resolution || '')];
    if (!resolution) {
      throw new BadRequestException('Invalid dispute resolution');
    }
    const order = await this.orderService.resolveDispute(id, resolution);
    return { success: true, data: order };
  }

  @Post(':id/retry-payment')
  async retryPayment(@Param('id') id: string, @Req() req: any) {
    if (String(req.user.role).toUpperCase() !== UserRole.BUYER) {
      throw new ForbiddenException('Only buyer accounts can retry payment');
    }
    const order = await this.orderService.retryPayment(id, this.requestUserId(req));
    return { success: true, data: order };
  }

  @Put(':id/rated')
  async markAsRated(@Param('id') id: string, @Req() req: any) {
    if (String(req.user.role).toUpperCase() !== UserRole.BUYER && !this.isAdmin(req)) {
      throw new ForbiddenException('Only buyer accounts can mark an order as rated');
    }

    const order = await this.orderService.getOrderById(id);
    this.assertBuyer(order, req, 'Only the buyer can mark an order as rated');
    const updated = await this.orderService.markAsRated(id);
    return { success: true, data: updated };
  }

  @Post(':id/quote')
  async sendQuote(@Param('id') id: string, @Body() body: SendQuoteDto, @Req() req: any) {
    if (String(req.user.role).toUpperCase() !== UserRole.SELLER) {
      throw new ForbiddenException('Only seller accounts can send quotes');
    }
    const order = await this.orderService.sendQuote(id, body.financials, this.requestUserId(req));
    return { success: true, data: order };
  }

  @Post(':id/admin/quote')
  async sendAdminQuote(@Param('id') id: string, @Body() body: SendQuoteDto, @Req() req: any) {
    if (!this.isAdmin(req)) {
      throw new ForbiddenException('Only an ADMIN can send seller-side quotes from the admin workspace');
    }
    const order = await this.orderService.sendQuote(id, body.financials, this.requestUserId(req), { allowAdminOverride: true });
    return { success: true, data: order };
  }

  @Post(':id/counter-offer')
  async counterOffer(@Param('id') id: string, @Body() body: { subtotal: number; note?: string }, @Req() req: any) {
    if (String(req.user.role).toUpperCase() !== UserRole.BUYER) {
      throw new ForbiddenException('Only buyer accounts can counter a quote');
    }
    const order = await this.orderService.counterOffer(id, body.subtotal, body.note, this.requestUserId(req));
    return { success: true, data: order };
  }

  @Post(':id/reject-quote')
  async rejectQuote(@Param('id') id: string, @Body() body: { reason?: string }, @Req() req: any) {
    if (String(req.user.role).toUpperCase() !== UserRole.BUYER) {
      throw new ForbiddenException('Only buyer accounts can reject a quote');
    }
    const order = await this.orderService.rejectQuote(id, body.reason || '', this.requestUserId(req));
    return { success: true, data: order };
  }

  @Post(':id/messages')
  async addMessage(@Param('id') id: string, @Body() body: AddMessageDto, @Req() req: any) {
    const order = await this.orderService.getOrderById(id);
    await this.assertParticipant(order, req);
    const updated = await this.orderService.addMessage(id, body, this.requestUserId(req), String(req.user.role || '').toUpperCase());
    return { success: true, data: updated };
  }

  @Put(':id/delivery-address')
  async updateDeliveryAddress(
    @Param('id') id: string,
    @Body() body: { address: string; coordinates: { lat: number; lng: number } },
    @Req() req: any,
  ) {
    if (String(req.user.role).toUpperCase() !== UserRole.BUYER) {
      throw new ForbiddenException('Only buyer accounts can update delivery location');
    }
    const order = await this.orderService.updateDeliveryAddress(id, body.address, body.coordinates, this.requestUserId(req));
    return { success: true, data: order };
  }

  @Public()
  @Patch(':id/delivery-dispatch-fee')
  async updateDeliveryDispatchFee(
    @Param('id') id: string,
    @Body() body: { deliveryFee: number; searchSurcharge?: number; radiusMeters?: number; userId?: string },
    @Req() req: any,
  ) {
    const userId = verifyInternalService(req);
    const order = await this.orderService.updateDeliveryDispatchFee(
      id,
      Number(body.deliveryFee),
      Number(body.searchSurcharge || 0),
      Number(body.radiusMeters || 0),
      userId,
    );
    return { success: true, data: order };
  }

  @Post('upload-image')
  @UseInterceptors(FileInterceptor('file', { limits: { fileSize: 5 * 1024 * 1024 } }))
  async uploadImage(@UploadedFile() file: any) {
    if (!file) {
      return { success: false, message: 'No file uploaded' };
    }
    const allowedMimeTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/avif'];
    if (!allowedMimeTypes.includes(file.mimetype)) {
      throw new BadRequestException('Only image uploads are allowed (jpeg, png, webp, gif, avif)');
    }
    const uploadDir = join(process.cwd(), 'uploads', 'order-images');
    if (!existsSync(uploadDir)) mkdirSync(uploadDir, { recursive: true });
    // Extension derives from the validated mime type, never the client-supplied
    // filename — prevents serving e.g. an .html file from the uploads directory.
    const extension = this.extensionFromMime(file.mimetype);
    const fileName = `${crypto.randomUUID()}${extension}`;
    writeFileSync(join(uploadDir, fileName), file.buffer);
    const port = (process.env.PORT && process.env.PORT !== '3000') ? process.env.PORT : 3006;
    const publicBaseUrl = process.env.ORDER_SERVICE_PUBLIC_URL || `http://localhost:${port}`;
    return { success: true, data: { url: `${publicBaseUrl}/uploads/order-images/${fileName}` } };
  }

  private extensionFromMime(mimeType: string): string {
    const extensions: Record<string, string> = {
      'image/jpeg': '.jpg',
      'image/png': '.png',
      'image/webp': '.webp',
      'image/gif': '.gif',
      'image/avif': '.avif',
    };
    return extensions[mimeType] || '.bin';
  }
}
