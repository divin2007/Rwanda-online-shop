import {
  Controller,
  Get,
  Post,
  Put,
  Patch,
  Body,
  Param,
  Request,
  Query,
  UseInterceptors,
  UploadedFile,
  BadRequestException,
  UseGuards,
  ForbiddenException,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { randomUUID } from 'crypto';
import { existsSync, mkdirSync, writeFileSync } from 'fs';
import { extname, join } from 'path';
import { DeliveryService } from './delivery.service';
import type { Coordinates } from '@rmf/location';
import { DeliveryStatus } from '@rmf/shared-types';
import { Public, JwtAuthGuard } from '@rmf/auth';

@Controller('deliveries')
export class DeliveryController {
  constructor(private readonly deliveryService: DeliveryService) {}

  @Post('fee')
  async calculateFee(@Body() data: { from: Coordinates; to: Coordinates; weightFactor?: number }) {
    const feeInfo = await this.deliveryService.calculateDeliveryFee(data.from, data.to, data.weightFactor);
    return { success: true, data: feeInfo };
  }

  @Get('available')
  async getAvailable() {
    const deliveries = await this.deliveryService.getAvailableDeliveries();
    return { success: true, data: deliveries };
  }

  // FIX [DELIVERY-ACTIVE]: Removed queryUserId fallback — prevents IDOR.
  @Get('active')
  async getActive(@Request() req: any) {
    const userId = req.user?.userId;
    if (!userId) return { success: true, data: null };
    const delivery = await this.deliveryService.getActiveDelivery(userId);
    return { success: true, data: delivery };
  }

  // FIX [DELIVERY-HISTORY]: Removed queryUserId fallback — prevents IDOR.
  @Get('history')
  async getHistory(@Request() req: any) {
    const userId = req.user?.userId;
    if (!userId) return { success: true, data: [] };
    const history = await this.deliveryService.getHistory(userId);
    return { success: true, data: history };
  }

  @Get('rider/:userId')
  async getRiderDeliveries(@Param('userId') userId: string, @Query('status') status?: string) {
    const deliveries = await this.deliveryService.getRiderDeliveries(userId, status);
    return { success: true, data: deliveries };
  }

  @Public()
  @Get(':id')
  async getDeliveryById(@Param('id') id: string) {
    const delivery = await this.deliveryService.getDeliveryById(id);
    return { success: true, data: delivery };
  }

  @Post()
  async create(@Body() data: any) {
    const delivery = await this.deliveryService.createDelivery(data);
    return { success: true, data: delivery };
  }

  @UseGuards(JwtAuthGuard)
  @Patch(':id/accept')
  async accept(@Param('id') id: string, @Request() req: any) {
    const delivery = await this.deliveryService.acceptDelivery(id, req.user.userId);
    return { success: true, data: delivery };
  }

  @UseGuards(JwtAuthGuard)
  @Patch(':id/reject')
  async reject(@Param('id') id: string) {
    const delivery = await this.deliveryService.rejectDelivery(id);
    return { success: true, data: delivery };
  }

  @UseGuards(JwtAuthGuard)
  @Patch(':id/complete')
  async complete(@Param('id') id: string) {
    const delivery = await this.deliveryService.updateStatus(id, DeliveryStatus.DELIVERED);
    return { success: true, data: delivery };
  }

  @Post(':id/scan-qr')
  async scanQr(@Param('id') id: string, @Body() data: { stallId: string; photoUrl?: string }) {
    const delivery = await this.deliveryService.photoVerifiedPickup(id, data.photoUrl || '', `marketrwanda:stall:${data.stallId}`);
    return { success: true, data: delivery };
  }

  // FIX [DELIVERY-PHOTO]: Was unauthenticated — anyone could upload files.
  @UseGuards(JwtAuthGuard)
  @Post(':id/pickup-photo')
  @UseInterceptors(FileInterceptor('file'))
  async uploadPhoto(@UploadedFile() file: any) {
    if (!file) {
      throw new BadRequestException('No photo file uploaded');
    }
    const uploadDir = join(process.cwd(), 'uploads', 'pickup-photos');
    if (!existsSync(uploadDir)) mkdirSync(uploadDir, { recursive: true });
    const extension = extname(file.originalname || '') || this.extensionFromMime(file.mimetype);
    const fileName = `${randomUUID()}${extension}`;
    writeFileSync(join(uploadDir, fileName), file.buffer);
    const publicBaseUrl = process.env.DELIVERY_SERVICE_PUBLIC_URL || `http://localhost:${process.env.PORT || 3008}`;
    return { success: true, data: { url: `${publicBaseUrl}/uploads/pickup-photos/${fileName}` } };
  }

  private extensionFromMime(mimeType: string): string {
    const extensions: Record<string, string> = {
      'image/jpeg': '.jpg',
      'image/png': '.png',
      'image/webp': '.webp',
      'image/gif': '.gif',
    };
    return extensions[mimeType] || '.bin';
  }

  @UseGuards(JwtAuthGuard)
  @Put(':id/status')
  async updateStatus(@Param('id') id: string, @Body() body: { status: DeliveryStatus }) {
    const delivery = await this.deliveryService.updateStatus(id, body.status);
    return { success: true, data: delivery };
  }

  @UseGuards(JwtAuthGuard)
  @Post(':id/pickup')
  async pickup(@Param('id') id: string, @Body() body: { photoUrl: string; qrData: string }) {
    const delivery = await this.deliveryService.photoVerifiedPickup(id, body.photoUrl, body.qrData);
    return { success: true, data: delivery };
  }

  @UseGuards(JwtAuthGuard)
  @Post(':id/location')
  async streamLocation(@Param('id') id: string, @Body() coords: Coordinates) {
    const delivery = await this.deliveryService.streamLocation(id, coords);
    return { success: true, data: delivery };
  }

  @UseGuards(JwtAuthGuard)
  @Post(':id/handover')
  async confirmHandover(@Param('id') id: string, @Body() body: { role: 'seller' | 'rider' }) {
    const delivery = await this.deliveryService.confirmHandover(id, body.role);
    return { success: true, data: delivery };
  }
}
