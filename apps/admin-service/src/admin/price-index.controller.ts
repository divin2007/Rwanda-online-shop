import { Controller, Get, Post, Patch, Param, Query, UseGuards } from '@nestjs/common';
import { PriceIndexService } from './price-index.service';
import { Roles, JwtAuthGuard, Public } from '@rmf/auth';
import { UserRole } from '@rmf/shared-types';

@Controller()
export class PriceIndexController {
  constructor(private readonly priceIndexService: PriceIndexService) {}

  // Public: query a specific week / market / category.
  @Public()
  @Get('price-index')
  async query(
    @Query('week') week?: string,
    @Query('marketId') marketId?: string,
    @Query('categoryId') categoryId?: string,
  ) {
    // Public queries only ever surface published records.
    const records = await this.priceIndexService.query({ week, marketId, categoryId });
    return { success: true, data: records.filter((r: any) => r.isPublished) };
  }

  // Public: most recent published week across all categories (optionally per market).
  @Public()
  @Get('price-index/latest')
  async latest(@Query('marketId') marketId?: string) {
    const data = await this.priceIndexService.latest(marketId);
    return { success: true, data };
  }

  // Admin: trigger computation for a given ISO week.
  @UseGuards(JwtAuthGuard)
  @Roles(UserRole.ADMIN)
  @Post('admin/price-index/compute/:week')
  async compute(@Param('week') week: string) {
    const data = await this.priceIndexService.computeForWeek(week);
    return { success: true, data };
  }

  // Admin: publish all records for a given ISO week.
  @UseGuards(JwtAuthGuard)
  @Roles(UserRole.ADMIN)
  @Patch('admin/price-index/publish/:week')
  async publish(@Param('week') week: string) {
    const data = await this.priceIndexService.publishWeek(week);
    return { success: true, data };
  }
}
