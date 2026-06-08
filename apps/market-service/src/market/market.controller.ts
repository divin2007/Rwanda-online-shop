import {
  Controller,
  Get,
  Post,
  Put,
  Body,
  Param,
  Query,
  UseInterceptors,
  UploadedFile,
  BadRequestException,
  UseGuards,
  Request,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { randomUUID } from 'crypto';
import { existsSync, mkdirSync, writeFileSync } from 'fs';
import { join } from 'path';
import { MarketService } from './market.service';
import { Roles, JwtAuthGuard, Public } from '@rmf/auth';
import { UserRole } from '@rmf/shared-types';
import { StorageService } from '../storage/storage.service';

@Controller('markets')
export class MarketController {
  constructor(
    private readonly marketService: MarketService,
    private readonly storageService: StorageService,
  ) {}

  private readonly imageExtensions: Record<string, string> = {
    'image/jpeg': '.jpg',
    'image/png': '.png',
    'image/webp': '.webp',
    'image/gif': '.gif',
  };

  // FIX [MARKET-UPLOAD]: Was unauthenticated — anyone could upload files to the server.
  @UseGuards(JwtAuthGuard)
  @Post('upload-image')
  @UseInterceptors(FileInterceptor('file', { limits: { fileSize: 5 * 1024 * 1024 } }))
  async uploadImage(@UploadedFile() file: any) {
    if (!file) {
      throw new BadRequestException('No image file provided');
    }
    const extension = this.extensionFromMime(file.mimetype);
    const fileName = `${randomUUID()}${extension}`;
    const url = await this.storageService.uploadFile(file.buffer, fileName, file.mimetype, 'markets');
    return { success: true, data: { url } };
  }

  private extensionFromMime(mimeType: string): string {
    const extension = this.imageExtensions[mimeType];
    if (!extension) {
      throw new BadRequestException('Unsupported image type. Upload JPG, PNG, WebP, or GIF.');
    }
    return extension;
  }

  // FIX [MARKET-CREATE]: Was unauthenticated — anyone could create markets.
  // Now requires ADMIN role.
  @UseGuards(JwtAuthGuard)
  @Roles(UserRole.ADMIN)
  @Post()
  async create(@Body() marketData: any) {
    const market = await this.marketService.create(marketData);
    return { success: true, data: market };
  }

  @Public()
  @Get('agreement')
  async getAgreement() {
    const agreement = await this.marketService.getAgreement();
    return { success: true, data: agreement };
  }

  // Public read — market listings are public marketplace data
  @Public()
  @Get()
  async findAll(@Query('activeOnly') activeOnly: string, @Query('type') type?: string) {
    const markets = await this.marketService.findAll({ activeOnly: activeOnly !== 'false', type });
    return { success: true, data: markets };
  }

  @Public()
  @Get('slug/:slug')
  async findBySlug(@Param('slug') slug: string) {
    const market = await this.marketService.findBySlug(slug);
    return { success: true, data: market };
  }

  @Public()
  @Get('geocode/search')
  async geocode(@Query('query') query: string) {
    const result = await this.marketService.geocode(query);
    return { success: true, data: result };
  }

  @Public()
  @Get('geocode/reverse')
  async reverseGeocode(@Query('lat') lat: string, @Query('lng') lng: string) {
    const result = await this.marketService.reverseGeocode(Number(lat), Number(lng));
    return { success: true, data: result };
  }

  @Public()
  @Get(':id')
  async findById(@Param('id') id: string) {
    const market = await this.marketService.findById(id);
    return { success: true, data: market };
  }

  // FIX [MARKET-UPDATE]: Was unauthenticated — anyone could modify market data.
  // Now requires ADMIN role.
  @UseGuards(JwtAuthGuard)
  @Roles(UserRole.ADMIN)
  @Put(':id')
  async update(@Param('id') id: string, @Body() updateData: any) {
    const market = await this.marketService.update(id, updateData);
    return { success: true, data: market };
  }

  // FIX [MARKET-SYNC]: Was unauthenticated admin action.
  @UseGuards(JwtAuthGuard)
  @Roles(UserRole.ADMIN)
  @Post('sync-imagery')
  async syncImagery() {
    await this.marketService.syncInstitutionalImagery();
    return { success: true, message: 'Institutional imagery synchronized' };
  }

  // FIX [MARKET-PENALTY]: Was unauthenticated — anyone could apply penalties to markets.
  @UseGuards(JwtAuthGuard)
  @Roles(UserRole.ADMIN)
  @Post(':id/penalties')
  async applyPenalty(
    @Param('id') id: string,
    @Body() penaltyData: { type: 'warning' | 'charge' | 'suspension'; reason: string },
  ) {
    const market = await this.marketService.applyPenalty(id, penaltyData.type, penaltyData.reason);
    return { success: true, data: market };
  }
}
