import { Controller, Get, Post, Put, Body, Param, Query, UseInterceptors, UploadedFile, BadRequestException } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { randomUUID } from 'crypto';
import { existsSync, mkdirSync, writeFileSync } from 'fs';
import { join } from 'path';
import { MarketService } from './market.service';

@Controller('markets')
export class MarketController {
  constructor(private readonly marketService: MarketService) {}

  private readonly imageExtensions: Record<string, string> = {
    'image/jpeg': '.jpg',
    'image/png': '.png',
    'image/webp': '.webp',
    'image/gif': '.gif'
  };

  @Post('upload-image')
  @UseInterceptors(FileInterceptor('file', { limits: { fileSize: 5 * 1024 * 1024 } }))
  async uploadImage(@UploadedFile() file: any) {
    if (!file) {
      throw new BadRequestException('No image file provided');
    }
    const extension = this.extensionFromMime(file.mimetype);
    const uploadDir = join(process.cwd(), 'uploads', 'markets');
    if (!existsSync(uploadDir)) mkdirSync(uploadDir, { recursive: true });
    const fileName = `${randomUUID()}${extension}`;
    writeFileSync(join(uploadDir, fileName), file.buffer);
    const publicBaseUrl = process.env.MARKET_SERVICE_PUBLIC_URL || `http://localhost:${process.env.PORT || 3002}`;
    return { success: true, data: { url: `${publicBaseUrl}/uploads/markets/${fileName}` } };
  }

  private extensionFromMime(mimeType: string): string {
    const extension = this.imageExtensions[mimeType];
    if (!extension) {
      throw new BadRequestException('Unsupported image type. Upload JPG, PNG, WebP, or GIF.');
    }
    return extension;
  }

  @Post()
  async create(@Body() marketData: any) {
    const market = await this.marketService.create(marketData);
    return { success: true, data: market };
  }

  @Get('agreement')
  async getAgreement() {
    const agreement = await this.marketService.getAgreement();
    return { success: true, data: agreement };
  }

  @Get()
  async findAll(@Query('activeOnly') activeOnly: string, @Query('type') type?: string) {
    const markets = await this.marketService.findAll({ activeOnly: activeOnly !== 'false', type });
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

  @Post('sync-imagery')
  async syncImagery() {
    await this.marketService.syncInstitutionalImagery();
    return { success: true, message: 'Institutional imagery synchronized' };
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
