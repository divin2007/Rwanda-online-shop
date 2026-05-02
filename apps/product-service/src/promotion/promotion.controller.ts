import { Controller, Post, Body, Get, Query } from '@nestjs/common';
import { PromotionService } from './promotion.service';

@Controller('promotions')
export class PromotionController {
  constructor(private readonly promotionService: PromotionService) {}

  @Post()
  async create(@Body() promotionData: any) {
    const promo = await this.promotionService.createPromotion(promotionData);
    return { success: true, data: promo };
  }

  @Get('active')
  async getActive(@Query('marketId') marketId?: string) {
    const promos = await this.promotionService.getActivePromotions(marketId);
    return { success: true, data: promos };
  }
}
