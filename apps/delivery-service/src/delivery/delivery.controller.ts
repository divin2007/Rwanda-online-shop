import { Controller, Get, Post, Put, Body, Param } from '@nestjs/common';
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

  @Post()
  async create(@Body() data: any) {
    const delivery = await this.deliveryService.createDelivery(data);
    return { success: true, data: delivery };
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
