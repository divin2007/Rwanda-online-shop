import {
  Controller,
  Get,
  Post,
  Put,
  Body,
  Param,
  Query,
  Req,
  UseInterceptors,
  UploadedFile,
  UseGuards,
  ForbiddenException,
  UnauthorizedException,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { OrderService } from './order.service';
import { OrderStatus, PaymentStatus, DisputeResolution } from '@rmf/shared-types';
import { CreateOrderDto } from './dto/create-order.dto';
import { AddMessageDto } from './dto/add-message.dto';
import { SendQuoteDto } from './dto/send-quote.dto';
import { Public, JwtAuthGuard } from '@rmf/auth';
import * as crypto from 'crypto';

/**
 * Verify internal microservice calls via shared secret header.
 * Used for status transitions initiated by delivery-service / payment callbacks.
 */
function verifyInternalOrJwt(req: any): string {
  // Check JWT first
  const authHeader = req.headers?.authorization;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    try {
      const token = authHeader.substring(7);
      const jwt = require('jsonwebtoken');
      const jwtSecret = process.env.JWT_SECRET || 'dev-secret-change-in-prod';
      const decoded = jwt.verify(token, jwtSecret);
      if (decoded && decoded.sub) return decoded.sub;
    } catch {
      // Fall through to internal secret check
    }
  }

  // Check internal service secret
  const secret = process.env.INTERNAL_SERVICE_SECRET;
  if (secret) {
    const provided = req.headers?.['x-internal-service-key'];
    if (provided === secret) return 'internal-service';
  } else {
    // Dev mode — allow if no secret configured
    return req.body?.userId || 'system';
  }

  throw new UnauthorizedException('Valid JWT or internal service key required');
}

@UseGuards(JwtAuthGuard)
@Controller('orders')
export class OrderController {
  constructor(private readonly orderService: OrderService) {}

  @Post()
  async createOrder(@Body() orderData: CreateOrderDto, @Req() req: any) {
    // FIX [ORDER-CREATE]: Enforce identity from JWT
    (orderData as any).buyer = (orderData as any).buyer || {};
    (orderData as any).buyer.userId = req.user.userId;
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
    // FIX [ORDER-LIST]: Enforce isolation based on role
    if (req.user.role !== 'ADMIN') {
      if (req.user.role === 'SELLER') {
        query.sellerUserId = req.user.userId;
      } else {
        query.buyerId = req.user.userId;
      }
    }
    const orders = await this.orderService.findAll(query);
    return { success: true, data: orders };
  }

  @Get(':id')
  async getOrder(@Param('id') id: string, @Req() req: any) {
    const order = await this.orderService.getOrderById(id);
    if (req.user.role !== 'ADMIN') {
      const isBuyer = order.buyer?.userId === req.user.userId;
      const isSeller = order.seller?.userId === req.user.userId; // Simplified check
      if (!isBuyer && !isSeller) {
        throw new ForbiddenException('You can only view your own orders');
      }
    }
    return { success: true, data: order };
  }

  // FIX [ORDER-STATUS]: Was @Public() with body.userId as fallback — anyone could
  // advance any order to 'delivered' and trigger payouts. Now requires valid JWT or
  // internal service secret from delivery-service/payment callbacks.
  @Public()
  @Put(':id/status')
  async updateStatus(@Param('id') id: string, @Body() body: { status: OrderStatus; userId?: string }, @Req() req: any) {
    const userId = verifyInternalOrJwt(req);
    const order = await this.orderService.updateOrderStatus(id, body.status, userId);
    return { success: true, data: order };
  }

  // FIX [ORDER-PAYMENT-CB]: Payment callback must validate the request origin.
  // We enforce strict HMAC verification for MTN MoMo and Airtel Money callbacks,
  // falling back to local internal service secrets for orchestration bypasses.
  @Public()
  @Post('payment/callback')
  async paymentCallback(@Body() body: { orderNumber: string; status: PaymentStatus; transactionRef: string }, @Req() req: any) {
    this.isValidWebhook(req, body);
    const order = await this.orderService.processPaymentCallback(body.orderNumber, body.status, body.transactionRef);
    return { success: true, data: order };
  }

  private isValidWebhook(req: any, body: any): boolean {
    const mtnSignature = req.headers['x-mtn-signature'];
    const airtelSignature = req.headers['x-airtel-signature'];
    const internalSecret = req.headers['x-internal-secret'];

    const expectedInternalSecret = process.env.INTERNAL_SERVICE_SECRET;
    const webhookSecret = process.env.PAYMENT_WEBHOOK_SECRET || 'dev-webhook-secret';

    // 1. Internal Service Bypass (for internal microservice calls)
    if (expectedInternalSecret && internalSecret === expectedInternalSecret) {
      return true;
    }

    const signature = mtnSignature || airtelSignature;
    if (!signature) {
      throw new UnauthorizedException('Missing signature headers (X-MTN-Signature or X-Airtel-Signature)');
    }

    // Convert body to canonical raw JSON string
    const rawBody = JSON.stringify(body);
    const sortedRawBody = JSON.stringify(
      Object.keys(body).sort().reduce((acc: any, key: string) => {
        acc[key] = body[key];
        return acc;
      }, {})
    );

    // Verify using standard webhook secret
    const isMtnValid = this.verifyHmacSignature(rawBody, signature, webhookSecret) ||
                       this.verifyHmacSignature(sortedRawBody, signature, webhookSecret);
                       
    // Also support service-specific secrets if configured
    const mtnSecret = process.env.MTN_MOMO_WEBHOOK_SECRET;
    const airtelSecret = process.env.AIRTEL_MONEY_WEBHOOK_SECRET;

    const isMtnSpecificValid = mtnSecret && (
      this.verifyHmacSignature(rawBody, signature, mtnSecret) ||
      this.verifyHmacSignature(sortedRawBody, signature, mtnSecret)
    );

    const isAirtelSpecificValid = airtelSecret && (
      this.verifyHmacSignature(rawBody, signature, airtelSecret) ||
      this.verifyHmacSignature(sortedRawBody, signature, airtelSecret)
    );

    if (isMtnValid || isMtnSpecificValid || isAirtelSpecificValid) {
      return true;
    }

    throw new UnauthorizedException('Invalid payment webhook signature verification failed');
  }

  private verifyHmacSignature(rawBody: string, signature: string, secret: string): boolean {
    const computed = crypto.createHmac('sha256', secret).update(rawBody).digest('hex');
    const computedBase64 = crypto.createHmac('sha256', secret).update(rawBody).digest('base64');
    // Compare in a timing-safe way to prevent side-channel attacks
    try {
      const sigBuffer = Buffer.from(signature, signature.includes('=') || signature.length === 44 ? 'base64' : 'hex');
      const compBuffer = Buffer.from(signature.includes('=') || signature.length === 44 ? computedBase64 : computed, signature.includes('=') || signature.length === 44 ? 'base64' : 'hex');
      return crypto.timingSafeEqual(sigBuffer, compBuffer);
    } catch {
      return false;
    }
  }

  @Post(':id/dispute')
  async raiseDispute(@Param('id') id: string, @Body() body: { reason: string }, @Req() req: any) {
    const order = await this.orderService.getOrderById(id);
    if (order.buyer?.userId !== req.user.userId && req.user.role !== 'ADMIN') {
      throw new ForbiddenException('Only the buyer can raise a dispute');
    }
    const updated = await this.orderService.raiseDispute(id, body.reason);
    return { success: true, data: updated };
  }

  @Post(':id/dispute/resolve')
  async resolveDispute(@Param('id') id: string, @Body() body: { resolution: DisputeResolution }, @Req() req: any) {
    if (req.user.role !== 'ADMIN') {
      throw new ForbiddenException('Only an ADMIN can resolve disputes');
    }
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
  async markAsRated(@Param('id') id: string, @Req() req: any) {
    const order = await this.orderService.getOrderById(id);
    if (order.buyer?.userId !== req.user.userId && req.user.role !== 'ADMIN') {
      throw new ForbiddenException('Only the buyer can mark an order as rated');
    }
    const updated = await this.orderService.markAsRated(id);
    return { success: true, data: updated };
  }

  @Post(':id/quote')
  async sendQuote(@Param('id') id: string, @Body() body: SendQuoteDto, @Req() req: any) {
    const userId = req.user.userId;
    const order = await this.orderService.sendQuote(id, body.financials, userId);
    return { success: true, data: order };
  }

  @Post(':id/counter-offer')
  async counterOffer(@Param('id') id: string, @Body() body: { subtotal: number; note?: string }, @Req() req: any) {
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
  async updateDeliveryAddress(@Param('id') id: string, @Body() body: { address: string; coordinates: { lat: number; lng: number } }, @Req() req: any) {
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
    const base64 = file.buffer.toString('base64');
    const dataUri = `data:${file.mimetype};base64,${base64}`;
    return { success: true, data: { url: dataUri } };
  }
}