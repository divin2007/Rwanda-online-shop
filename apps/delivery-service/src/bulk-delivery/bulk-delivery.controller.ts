import { Controller, Get, Post, Patch, Body, Param, Query, Request, UseGuards } from '@nestjs/common';
import { BulkDeliveryService } from './bulk-delivery.service';
import { Roles, JwtAuthGuard } from '@rmf/auth';
import { UserRole } from '@rmf/shared-types';

@Controller('bulk-deliveries')
export class BulkDeliveryController {
  constructor(private readonly bulkService: BulkDeliveryService) {}

  // Verified B2B buyer creates a same-day bulk delivery.
  @UseGuards(JwtAuthGuard)
  @Post()
  async create(@Request() req: any, @Body() body: any) {
    const data = await this.bulkService.create(req.user.userId, body);
    return { success: true, data };
  }

  @UseGuards(JwtAuthGuard)
  @Get('mine')
  async mine(@Request() req: any, @Query('page') page?: string, @Query('limit') limit?: string) {
    const data = await this.bulkService.mine(req.user.userId, Number(page) || 1, Number(limit) || 20);
    return { success: true, data };
  }

  @UseGuards(JwtAuthGuard)
  @Get(':id')
  async getById(@Request() req: any, @Param('id') id: string) {
    const data = await this.bulkService.getById(id, req.user.userId, req.user.role);
    return { success: true, data };
  }

  // Admin assigns a rider (riderUserId optional → nearest available).
  @UseGuards(JwtAuthGuard)
  @Roles(UserRole.ADMIN)
  @Patch(':id/assign-rider')
  async assignRider(@Param('id') id: string, @Body() body: { riderUserId?: string }) {
    const data = await this.bulkService.assignRider(id, body?.riderUserId);
    return { success: true, data };
  }

  // Assigned rider confirms a dropoff.
  @UseGuards(JwtAuthGuard)
  @Roles(UserRole.RIDER)
  @Patch(':id/dropoff/:index/confirm')
  async confirmDropoff(@Request() req: any, @Param('id') id: string, @Param('index') index: string) {
    const data = await this.bulkService.confirmDropoff(id, Number(index), req.user.userId);
    return { success: true, data };
  }
}
