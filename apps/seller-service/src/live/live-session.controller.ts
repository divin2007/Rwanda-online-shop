import { Controller, Get, Post, Body, Param, Query, Request, UseGuards } from '@nestjs/common';
import { LiveSessionService } from './live-session.service';
import { Roles, JwtAuthGuard, Public } from '@rmf/auth';
import { UserRole } from '@rmf/shared-types';

@Controller('live-sessions')
export class LiveSessionController {
  constructor(private readonly liveService: LiveSessionService) {}

  // Seller starts a session. Response includes streamKey ONLY for the owner.
  @UseGuards(JwtAuthGuard)
  @Roles(UserRole.SELLER)
  @Post('start')
  async start(@Request() req: any) {
    const data = await this.liveService.start(req.user.userId);
    return { success: true, data };
  }

  @UseGuards(JwtAuthGuard)
  @Roles(UserRole.SELLER)
  @Post(':id/end')
  async end(@Request() req: any, @Param('id') id: string) {
    const data = await this.liveService.end(req.user.userId, id);
    return { success: true, data };
  }

  // Public list of active sessions — never includes streamKey.
  @Public()
  @Get('active')
  async active(@Query('marketId') marketId?: string) {
    const data = await this.liveService.listActive(marketId);
    return { success: true, data };
  }

  @UseGuards(JwtAuthGuard)
  @Roles(UserRole.SELLER)
  @Post(':id/feature-product')
  async featureProduct(@Request() req: any, @Param('id') id: string, @Body() body: { productId: string }) {
    const data = await this.liveService.featureProduct(req.user.userId, id, body?.productId);
    return { success: true, data };
  }

  @UseGuards(JwtAuthGuard)
  @Roles(UserRole.SELLER)
  @Get(':id/orders')
  async orders(@Request() req: any, @Param('id') id: string) {
    const data = await this.liveService.getOrders(req.user.userId, id);
    return { success: true, data };
  }
}
