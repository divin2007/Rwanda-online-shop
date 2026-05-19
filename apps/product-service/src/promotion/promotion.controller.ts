import { Controller, Post, Body, Get, Delete, Param, Query, UseGuards, Request } from '@nestjs/common';
import { PromotionService } from './promotion.service';
import { JwtAuthGuard, Roles, Public } from '@rmf/auth';
import { UserRole } from '@rmf/shared-types';

@Controller('promotions')
export class PromotionController {
  constructor(private readonly promotionService: PromotionService) {}

  @UseGuards(JwtAuthGuard)
  @Roles(UserRole.SELLER, UserRole.ADMIN)
  @Post()
  async create(@Body() promotionData: any, @Request() req: any) {
    const promo = await this.promotionService.createPromotion(
      req.user.role === UserRole.ADMIN ? promotionData : { ...promotionData, sellerId: req.user.userId },
    );
    return { success: true, data: promo };
  }

  @Public()
  @Get('active')
  async getActive(@Query('marketId') marketId?: string) {
    const promos = await this.promotionService.getActivePromotions(marketId);
    return { success: true, data: promos };
  }

  @UseGuards(JwtAuthGuard)
  @Roles(UserRole.SELLER, UserRole.ADMIN)
  @Get()
  async findAll(@Query('sellerId') sellerId: string | undefined, @Query('marketId') marketId: string | undefined, @Request() req: any) {
    const effectiveSellerId = req.user.role === UserRole.ADMIN ? sellerId : req.user.userId;
    const promos = await this.promotionService.findAll(effectiveSellerId, marketId);
    return { success: true, data: promos };
  }

  @UseGuards(JwtAuthGuard)
  @Roles(UserRole.SELLER, UserRole.ADMIN)
  @Delete(':id')
  async delete(@Param('id') id: string, @Request() req: any) {
    const result = await this.promotionService.deletePromotion(id, req.user.userId, req.user.role);
    return { success: true, data: result };
  }
}
