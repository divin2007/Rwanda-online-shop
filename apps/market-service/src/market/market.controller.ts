import { Controller, Get, Post, Put, Body, Param, Query, UseInterceptors, UploadedFile, BadRequestException } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { MarketService } from './market.service';

@Controller('markets')
export class MarketController {
  constructor(private readonly marketService: MarketService) {}

  @Post('upload-image')
  @UseInterceptors(FileInterceptor('file'))
  async uploadImage(@UploadedFile() file: any) {
    if (!file) {
      throw new BadRequestException('No image file provided');
    }
    const base64 = file.buffer.toString('base64');
    const dataUri = `data:${file.mimetype};base64,${base64}`;
    return { success: true, data: { url: dataUri } };
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
