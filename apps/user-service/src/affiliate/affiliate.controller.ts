import { Controller, Get, Post, Body, Query, Request, UseGuards } from '@nestjs/common';
import { AffiliateService } from './affiliate.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';

@Controller('affiliates')
export class AffiliateController {
  constructor(private readonly affiliateService: AffiliateService) {}

  @UseGuards(JwtAuthGuard)
  @Post('apply')
  async apply(@Request() req: any, @Body() body: any) {
    const data = await this.affiliateService.apply(req.user.userId, body || {});
    return { success: true, data };
  }

  @UseGuards(JwtAuthGuard)
  @Get('me')
  async me(@Request() req: any) {
    const data = await this.affiliateService.getMe(req.user.userId);
    return { success: true, data };
  }

  @UseGuards(JwtAuthGuard)
  @Get('links')
  async links(@Request() req: any) {
    const data = await this.affiliateService.getLinks(req.user.userId);
    return { success: true, data };
  }

  @UseGuards(JwtAuthGuard)
  @Post('links')
  async createLink(@Request() req: any, @Body() body: any) {
    const data = await this.affiliateService.createLink(req.user.userId, body || {});
    return { success: true, data };
  }

  @UseGuards(JwtAuthGuard)
  @Get('earnings')
  async earnings(@Request() req: any, @Query('page') page?: string, @Query('limit') limit?: string) {
    const data = await this.affiliateService.getEarnings(req.user.userId, Number(page) || 1, Number(limit) || 20);
    return { success: true, data };
  }
}
