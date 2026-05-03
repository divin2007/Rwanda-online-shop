import { Controller, Get, Post, Put, Patch, Body, Param, Request } from '@nestjs/common';
import { DeliveryService } from './delivery.service';
import type { Coordinates } from '@rmf/location';
import { DeliveryStatus } from '@rmf/shared-types';

@Controller('deliveries')
export class DeliveryController {
  constructor(private readonly deliveryService: DeliveryService) {}

  @Post('fee')
  async calculateFee(@Body() data: { from: Coordinates, to: Coordinates, weightFactor?: number }) {
    const feeInfo = await this.deliveryService.calculateDeliveryFee(data.from, data.to, data.weightFactor);
    return { success: true, data: feeInfo };
  }

  @Get('active')
  async getActive(@Request() req: any) {
    const userId = req.user?.userId || "65f12345678901234567890a";
    const delivery = await this.deliveryService.getActiveDelivery(userId);
    return { success: true, data: delivery };
  }

  @Post()
  async create(@Body() data: any) {
    const delivery = await this.deliveryService.createDelivery(data);
    return { success: true, data: delivery };
  }

  @Patch(':id/accept')
  async accept(@Param('id') id: string) {
    const delivery = await this.deliveryService.acceptDelivery(id);
    return { success: true, data: delivery };
  }

  @Patch(':id/reject')
  async reject(@Param('id') id: string) {
    const delivery = await this.deliveryService.rejectDelivery(id);
    return { success: true, data: delivery };
  }

  @Patch(':id/complete')
  async complete(@Param('id') id: string) {
    const delivery = await this.deliveryService.updateStatus(id, DeliveryStatus.DELIVERED);
    return { success: true, data: delivery };
  }

  @Post(':id/scan-qr')
  async scanQr(@Param('id') id: string, @Body() data: { stallId: string }) {
    const delivery = await this.deliveryService.photoVerifiedPickup(id, "dummy_photo_url", `marketrwanda:stall:${data.stallId}`);
    return { success: true, data: delivery };
  }

  @Post(':id/pickup-photo')
  async uploadPhoto(@Param('id') id: string, @Body() data: { url: string }) {
    // This would typically update the photo URL before QR scan
    return { success: true, data: { url: data.url } };
  }

  @Put(':id/status')
  async updateStatus(@Param('id') id: string, @Body() body: { status: DeliveryStatus }) {
    const delivery = await this.deliveryService.updateStatus(id, body.status);
    return { success: true, data: delivery };
  }

  @Post(':id/pickup')
  async pickup(@Param('id') id: string, @Body() body: { photoUrl: string, qrData: string }) {
    const delivery = await this.deliveryService.photoVerifiedPickup(id, body.photoUrl, body.qrData);
    return { success: true, data: delivery };
  }

  @Post(':id/location')
  async streamLocation(@Param('id') id: string, @Body() coords: Coordinates) {
    const delivery = await this.deliveryService.streamLocation(id, coords);
    return { success: true, data: delivery };
  }
}
