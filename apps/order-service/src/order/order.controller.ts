import {
  Body,
  BadRequestException,
  Controller,
  ForbiddenException,
  Get,
  Head,
  Logger,
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
import { DisputeResolution, DisputeType, OrderStatus, PaymentStatus, UserRole } from '@rmf/shared-types';
import axios from 'axios';
import * as crypto from 'crypto';
import { existsSync, mkdirSync, writeFileSync } from 'fs';
import { extname, join } from 'path';
import { AddMessageDto } from './dto/add-message.dto';
import { CreateOrderDto } from './dto/create-order.dto';
import { SendQuoteDto } from './dto/send-quote.dto';
import { OrderService } from './order.service';
import { PaymentService } from './payment.service';

/**
 * Verify internal microservice calls via shared secret header.
 * Used for status transitions initiated by delivery-service / payment callbacks.
 */
function verifyInternalOrJwt(req: any): string {
  const authHeader = req.headers?.authorization;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    try {
      const token = authHeader.substring(7);
      const jwt = require('jsonwebtoken');
      const jwtSecret = process.env.JWT_SECRET || 'dev-secret-change-in-prod';
      const decoded = jwt.verify(token, jwtSecret);
      const userId = decoded?.sub || decoded?.userId || decoded?.id;
      if (userId) return String(userId);
    } catch {
      // Fall through to internal secret check.
    }
  }

  const secret = process.env.INTERNAL_SERVICE_SECRET;
  if (secret) {
    const provided = req.headers?.['x-internal-service-key'] || req.headers?.['x-internal-secret'];
    if (provided === secret) return 'internal-service';
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
  private readonly logger = new Logger(OrderController.name);

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

  @Get('payment/mtn/readiness')
  mtnReadiness(@Req() req: any) {
    if (!this.isAdmin(req)) {
      throw new ForbiddenException('Admin access required');
    }
    return { success: true, data: this.paymentService.getMtnReadiness() };
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
    const userId = verifyInternalOrJwt(req);
    const order = await this.orderService.updateOrderStatus(id, body.status, userId);
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
  @Head('payment/mtn/callback')
  mtnWebhookHealthcheck() {
    return;
  }

  // MTN MoMo posts callbacks without auth headers. There is no HMAC; we verify by
  // confirming the referenceId maps to a known order before mutating any state.
  // Always respond 200 so MTN does not retry indefinitely.
  @Public()
  @Post('payment/mtn/callback')
  async mtnPaymentCallback(@Body() body: any) {
    let event;
    try {
      event = this.paymentService.parseMtnCallback(body);
    } catch (error: any) {
      this.logger.warn(`[MTN callback] Unparseable payload: ${error?.message || 'unknown'}`);
      return { success: false, error: 'Invalid MTN callback payload' };
    }

    this.logger.log(`[MTN callback] referenceId=${event.transactionRef} status=${event.rawStatus || event.status}`);

    const order = await this.orderService.findOrderByPaymentReference(event.transactionRef, event.orderNumber);
    if (!order) {
      this.logger.warn(`[MTN callback] No order found for referenceId=${event.transactionRef}`);
      return { success: false, error: 'Unknown reference' };
    }

    const status = event.status === 'SUCCESSFUL'
      ? PaymentStatus.PAID
      : event.status === 'FAILED'
        ? PaymentStatus.FAILED
        : PaymentStatus.PENDING;

    try {
      await this.orderService.processPaymentCallbackByReference(
        status,
        event.transactionRef,
        event.orderNumber,
      );
    } catch (error: any) {
      this.logger.error(`[MTN callback] Processing failed for ${event.transactionRef}: ${error?.message}`);
    }

    return { success: true };
  }

  private isValidWebhook(req: any, body: any): boolean {
    const mtnSignature = req.headers['x-mtn-signature'];
    const internalSecret = req.headers['x-internal-secret'] || req.headers['x-internal-service-key'];

    const expectedInternalSecret = process.env.INTERNAL_SERVICE_SECRET;
    const webhookSecret = process.env.PAYMENT_WEBHOOK_SECRET || 'dev-webhook-secret';

    if (expectedInternalSecret && internalSecret === expectedInternalSecret) {
      return true;
    }

    const signature = mtnSignature;
    if (!signature) {
      throw new UnauthorizedException('Missing signature header (X-MTN-Signature)');
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

    const isMtnSpecificValid =
      mtnSecret &&
      (this.verifyHmacSignature(rawBody, signature, mtnSecret) ||
        this.verifyHmacSignature(sortedRawBody, signature, mtnSecret));

    if (isMtnValid || isMtnSpecificValid) {
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
  async raiseDispute(@Param('id') id: string, @Body() body: { reason: string; evidenceUrls?: string[]; type?: string }, @Req() req: any) {
    if (String(req.user.role).toUpperCase() !== UserRole.BUYER && !this.isAdmin(req)) {
      throw new ForbiddenException('Only buyer accounts can raise disputes');
    }

    const order = await this.orderService.getOrderById(id);
    this.assertBuyer(order, req, 'Only the buyer can raise a dispute');
    const disputeType = Object.values(DisputeType).includes(String(body.type) as DisputeType)
      ? (String(body.type) as DisputeType)
      : DisputeType.GENERAL;
    const updated = await this.orderService.raiseDispute(
      id,
      body.reason,
      Array.isArray(body.evidenceUrls) ? body.evidenceUrls : [],
      disputeType,
    );
    return { success: true, data: updated };
  }

  @Post(':id/dispute/resolve')
  async resolveDispute(
    @Param('id') id: string,
    @Body() body: { resolution: DisputeResolution | string; refundPercentage?: number },
    @Req() req: any,
  ) {
    if (!this.isAdmin(req)) {
      throw new ForbiddenException('Only an ADMIN can resolve disputes');
    }
    const resolutionMap: Record<string, DisputeResolution> = {
      REFUND: DisputeResolution.REFUND,
      refund: DisputeResolution.REFUND,
      PARTIAL_REFUND: DisputeResolution.PARTIAL_REFUND,
      partial_refund: DisputeResolution.PARTIAL_REFUND,
      PARTIAL: DisputeResolution.PARTIAL_REFUND,
      partial: DisputeResolution.PARTIAL_REFUND,
      REDELIVER: DisputeResolution.REDELIVER,
      redeliver: DisputeResolution.REDELIVER,
      NO_REFUND: DisputeResolution.REJECT,
      REJECT: DisputeResolution.REJECT,
      reject: DisputeResolution.REJECT,
    };
    const resolution = resolutionMap[String(body.resolution || '')];
    if (!resolution) {
      throw new BadRequestException('Invalid dispute resolution');
    }
    const order = await this.orderService.resolveDispute(id, resolution, body.refundPercentage);
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
  @UseInterceptors(FileInterceptor('file'))
  async uploadImage(@UploadedFile() file: any) {
    if (!file) {
      return { success: false, message: 'No file uploaded' };
    }
    const uploadDir = join(process.cwd(), 'uploads', 'order-images');
    if (!existsSync(uploadDir)) mkdirSync(uploadDir, { recursive: true });
    const extension = extname(file.originalname || '') || this.extensionFromMime(file.mimetype);
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
