import { Controller, Get, Post, Patch, Body, Param, Query, Request, UseGuards } from '@nestjs/common';
import { ErrandService } from './errand.service';
import { Roles, JwtAuthGuard } from '@rmf/auth';
import { UserRole } from '@rmf/shared-types';

@Controller('errands')
export class ErrandController {
  constructor(private readonly errandService: ErrandService) {}

  @UseGuards(JwtAuthGuard)
  @Roles(UserRole.BUYER)
  @Post()
  async create(@Request() req: any, @Body() body: any) {
    const data = await this.errandService.create(req.user.userId, body);
    return { success: true, data };
  }

  @UseGuards(JwtAuthGuard)
  @Roles(UserRole.RIDER)
  @Get()
  async listOpen(@Request() req: any) {
    const data = await this.errandService.listOpenForRider(req.user.userId);
    return { success: true, data };
  }

  @UseGuards(JwtAuthGuard)
  @Roles(UserRole.BUYER)
  @Get('my')
  async myErrands(@Request() req: any, @Query('page') page?: string, @Query('limit') limit?: string) {
    const data = await this.errandService.myErrands(req.user.userId, Number(page) || 1, Number(limit) || 20);
    return { success: true, data };
  }

  @UseGuards(JwtAuthGuard)
  @Roles(UserRole.RIDER)
  @Patch(':id/accept')
  async accept(@Request() req: any, @Param('id') id: string) {
    const data = await this.errandService.accept(id, req.user.userId);
    return { success: true, data };
  }

  @UseGuards(JwtAuthGuard)
  @Roles(UserRole.RIDER)
  @Patch(':id/status')
  async updateStatus(@Request() req: any, @Param('id') id: string, @Body() body: { status: string }) {
    const data = await this.errandService.updateStatus(id, req.user.userId, body?.status);
    return { success: true, data };
  }

  @UseGuards(JwtAuthGuard)
  @Roles(UserRole.RIDER)
  @Patch(':id/location')
  async location(@Request() req: any, @Param('id') id: string, @Body() body: { lat: number; lng: number }) {
    const data = await this.errandService.appendTracking(id, req.user.userId, body.lat, body.lng);
    return { success: true, data };
  }

  // Buyer, assigned rider, or admin.
  @UseGuards(JwtAuthGuard)
  @Get(':id')
  async getById(@Request() req: any, @Param('id') id: string) {
    const data = await this.errandService.getById(id, req.user.userId, req.user.role);
    return { success: true, data };
  }
}
