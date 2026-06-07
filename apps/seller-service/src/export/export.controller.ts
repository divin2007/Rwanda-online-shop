import { Controller, Get, Post, Patch, Body, Query, Request, UseGuards } from '@nestjs/common';
import { ExportService } from './export.service';
import { Roles, JwtAuthGuard, Public } from '@rmf/auth';
import { UserRole } from '@rmf/shared-types';

@Controller('export')
export class ExportController {
  constructor(private readonly exportService: ExportService) {}

  // Public export catalogue.
  @Public()
  @Get('products')
  async listProducts(
    @Query('categoryId') categoryId?: string,
    @Query('marketId') marketId?: string,
    @Query('minQty') minQty?: string,
  ) {
    const data = await this.exportService.listExportProducts({
      categoryId,
      marketId,
      minQty: minQty ? Number(minQty) : undefined,
    });
    return { success: true, data };
  }

  // Authenticated buyer submits an export inquiry.
  @UseGuards(JwtAuthGuard)
  @Post('inquiries')
  async createInquiry(@Request() req: any, @Body() body: any) {
    const data = await this.exportService.createInquiry(req.user.userId, body);
    return { success: true, data };
  }

  // Authenticated buyer's own inquiries.
  @UseGuards(JwtAuthGuard)
  @Get('inquiries/mine')
  async myInquiries(@Request() req: any) {
    const data = await this.exportService.myInquiries(req.user.userId);
    return { success: true, data };
  }
}

/**
 * Seller-scoped export endpoints live under the /seller prefix per the mission spec.
 */
@Controller('seller')
export class SellerExportController {
  constructor(private readonly exportService: ExportService) {}

  @UseGuards(JwtAuthGuard)
  @Roles(UserRole.SELLER)
  @Patch('me/export-settings')
  async updateExportSettings(@Request() req: any, @Body() body: any) {
    const data = await this.exportService.updateExportSettings(req.user.userId, body);
    return { success: true, data };
  }

  @UseGuards(JwtAuthGuard)
  @Roles(UserRole.SELLER)
  @Get('me/export-inquiries')
  async sellerInquiries(@Request() req: any) {
    const data = await this.exportService.sellerInquiries(req.user.userId);
    return { success: true, data };
  }
}
