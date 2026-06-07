import { Controller, Get, Post, Param, Request, UseGuards } from '@nestjs/common';
import { FreshnessService } from './freshness.service';
import { Roles, JwtAuthGuard, Public } from '@rmf/auth';
import { UserRole } from '@rmf/shared-types';

@Controller()
export class FreshnessController {
  constructor(private readonly freshnessService: FreshnessService) {}

  // Authenticated seller daily check-in. Path: /api/v1/seller/freshness-checkin
  @UseGuards(JwtAuthGuard)
  @Roles(UserRole.SELLER)
  @Post('seller/freshness-checkin')
  async checkIn(@Request() req: any) {
    const data = await this.freshnessService.checkIn(req.user.userId);
    return { success: true, data };
  }

  // Public freshness status. Path: /api/v1/sellers/:id/freshness
  @Public()
  @Get('sellers/:id/freshness')
  async getStatus(@Param('id') id: string) {
    const data = await this.freshnessService.getStatus(id);
    return { success: true, data };
  }
}
