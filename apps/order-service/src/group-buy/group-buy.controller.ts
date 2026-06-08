import { Controller, Get, Post, Body, Param, Query, Request, UseGuards } from '@nestjs/common';
import { GroupBuyService } from './group-buy.service';
import { Roles, JwtAuthGuard, Public } from '@rmf/auth';
import { UserRole } from '@rmf/shared-types';

@Controller('group-buys')
export class GroupBuyController {
  constructor(private readonly groupBuyService: GroupBuyService) {}

  @UseGuards(JwtAuthGuard)
  @Roles(UserRole.SELLER)
  @Post()
  async create(@Request() req: any, @Body() body: any) {
    const data = await this.groupBuyService.create(req.user.userId, body);
    return { success: true, data };
  }

  @Public()
  @Get()
  async list(@Query('marketId') marketId?: string, @Query('productId') productId?: string, @Query('status') status?: string) {
    const data = await this.groupBuyService.list({ marketId, productId, status });
    return { success: true, data };
  }

  @Public()
  @Get(':id')
  async getOne(@Param('id') id: string) {
    const data = await this.groupBuyService.getPublic(id);
    return { success: true, data };
  }

  @UseGuards(JwtAuthGuard)
  @Roles(UserRole.BUYER)
  @Post(':id/join')
  async join(@Request() req: any, @Param('id') id: string, @Body() body: any) {
    const data = await this.groupBuyService.join(id, req.user.userId, body || {});
    return { success: true, data };
  }

  @UseGuards(JwtAuthGuard)
  @Roles(UserRole.SELLER)
  @Post(':id/lock')
  async lock(@Request() req: any, @Param('id') id: string) {
    const data = await this.groupBuyService.lockBySeller(id, req.user.userId);
    return { success: true, data };
  }
}
