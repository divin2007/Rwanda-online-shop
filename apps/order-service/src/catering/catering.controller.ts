import { Controller, Get, Post, Patch, Body, Param, Query, Request, UseGuards } from '@nestjs/common';
import { CateringService } from './catering.service';
import { Roles, JwtAuthGuard } from '@rmf/auth';
import { UserRole } from '@rmf/shared-types';

@Controller('catering')
export class CateringController {
  constructor(private readonly cateringService: CateringService) {}

  // Institution (verified B2B) posts a brief.
  @UseGuards(JwtAuthGuard)
  @Post('briefs')
  async createBrief(@Request() req: any, @Body() body: any) {
    const data = await this.cateringService.createBrief(req.user.userId, body);
    return { success: true, data };
  }

  // Sellers see open briefs; institutions see their own.
  @UseGuards(JwtAuthGuard)
  @Get('briefs')
  async listBriefs(@Request() req: any, @Query('status') status?: string) {
    const data = await this.cateringService.listBriefs(req.user.userId, req.user.role, status);
    return { success: true, data };
  }

  @UseGuards(JwtAuthGuard)
  @Get('briefs/:id')
  async getBrief(@Request() req: any, @Param('id') id: string) {
    const data = await this.cateringService.getBrief(id, req.user.userId, req.user.role);
    return { success: true, data };
  }

  // Seller submits a bid.
  @UseGuards(JwtAuthGuard)
  @Roles(UserRole.SELLER)
  @Post('briefs/:id/bids')
  async submitBid(@Request() req: any, @Param('id') id: string, @Body() body: any) {
    const data = await this.cateringService.submitBid(id, req.user.userId, body);
    return { success: true, data };
  }

  // Institution awards a bid.
  @UseGuards(JwtAuthGuard)
  @Patch('briefs/:id/award/:bidId')
  async awardBid(@Request() req: any, @Param('id') id: string, @Param('bidId') bidId: string) {
    const data = await this.cateringService.awardBid(id, bidId, req.user.userId);
    return { success: true, data };
  }
}
