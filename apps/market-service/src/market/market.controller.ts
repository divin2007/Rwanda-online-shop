import { Controller, Get, Post, Put, Body, Param, Query } from '@nestjs/common';
import { MarketService } from './market.service';
// In a full implementation, we would import AuthGuard here

@Controller('markets')
export class MarketController {
  constructor(private readonly marketService: MarketService) {}

  @Post()
  async create(@Body() marketData: any) {
    const market = await this.marketService.create(marketData);
    return { success: true, data: market };
  }

  @Get()
  async findAll(@Query('activeOnly') activeOnly: string) {
    const markets = await this.marketService.findAll(activeOnly !== 'false');
    return { success: true, data: markets };
  }

  @Get('slug/:slug')
  async findBySlug(@Param('slug') slug: string) {
    const market = await this.marketService.findBySlug(slug);
    return { success: true, data: market };
  }

  @Get(':id')
  async findById(@Param('id') id: string) {
    const market = await this.marketService.findById(id);
    return { success: true, data: market };
  }

  @Put(':id')
  async update(@Param('id') id: string, @Body() updateData: any) {
    const market = await this.marketService.update(id, updateData);
    return { success: true, data: market };
  }

  @Post(':id/penalties')
  async applyPenalty(
    @Param('id') id: string, 
    @Body() penaltyData: { type: 'warning' | 'charge' | 'suspension', reason: string }
  ) {
    const market = await this.marketService.applyPenalty(id, penaltyData.type, penaltyData.reason);
    return { success: true, data: market };
  }
}
