import { Controller, Get, Post, Put, Patch, Body, Param, Request, Query, UseInterceptors, UploadedFile, BadRequestException } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { randomUUID } from 'crypto';
import { existsSync, mkdirSync, writeFileSync } from 'fs';
import { join } from 'path';
import { RiderService } from './rider.service';
import type { Coordinates } from '@rmf/location';

@Controller('riders')
export class RiderController {
  constructor(private readonly riderService: RiderService) {}

  private readonly documentExtensions: Record<string, string> = {
    'application/pdf': '.pdf',
    'image/jpeg': '.jpg',
    'image/png': '.png',
    'image/webp': '.webp',
  };

  @Post('register')
  async create(@Body() riderData: any) {
    const rider = await this.riderService.create(riderData);
    return { success: true, data: rider };
  }

  @Get('me')
  async findMe(@Request() req: any, @Query('userId') queryUserId?: string) {
    try {
        const userId = req.user?.userId || queryUserId;
        if (!userId) return { success: true, data: null };
        const rider = await this.riderService.findByUserId(userId);
        return { success: true, data: rider };
    } catch (e) {
        return { success: true, data: null };
    }
  }

  @Patch('me/status')
  async updateMyStatus(@Request() req: any, @Body() data: { isActive: boolean, location?: Coordinates, userId?: string }) {
    const userId = req.user?.userId || data.userId;
    const rider = await this.riderService.updateStatus(userId, data.isActive, data.location);
    return { success: true, data: rider };
  }

  @Patch('me/location')
  async updateMyLocation(@Request() req: any, @Body() data: { lat: number, lng: number, userId?: string }) {
    const userId = req.user?.userId || data.userId;
    const rider = await this.riderService.updateLocation(userId, data);
    return { success: true, data: rider };
  }

  @Get('stats/:userId')
  async getStats(@Param('userId') userId: string) {
    const stats = await this.riderService.getStats(userId);
    return { success: true, data: stats };
  }

  @Get('user/:userId')
  async findByUserId(@Param('userId') userId: string) {
    const rider = await this.riderService.findByUserId(userId);
    return { success: true, data: rider };
  }

  @Put('user/:userId/status')
  async updateStatus(
    @Param('userId') userId: string, 
    @Body() data: { isActive: boolean, location?: Coordinates }
  ) {
    const rider = await this.riderService.updateStatus(userId, data.isActive, data.location);
    return { success: true, data: rider };
  }

  @Put('user/:userId/location')
  async updateLocation(
    @Param('userId') userId: string, 
    @Body() location: Coordinates
  ) {
    const rider = await this.riderService.updateLocation(userId, location);
    return { success: true, data: rider };
  }

  @Get()
  async findAll(@Query('isApproved') isApproved?: string) {
    const riders = await this.riderService.findAll(isApproved === 'true' || isApproved === 'false' ? isApproved === 'true' : undefined);
    return { success: true, data: riders };
  }

  @Post(':id/approve')
  async approve(@Param('id') id: string) {
    const rider = await this.riderService.approve(id);
    return { success: true, data: rider };
  }

  // 4A fix: reject endpoint for admin to decline rider applications
  @Post(':id/reject')
  async reject(@Param('id') id: string, @Body() body?: { reason?: string }) {
    const rider = await this.riderService.reject(id, body?.reason);
    return { success: true, data: rider };
  }

  @Post('upload-document')
  @UseInterceptors(FileInterceptor('file', { limits: { fileSize: 8 * 1024 * 1024 } }))
  async uploadDocument(@UploadedFile() file: any) {
    if (!file) {
      throw new BadRequestException('No file uploaded');
    }
    const extension = this.extensionFromMime(file.mimetype);
    const uploadDir = join(process.cwd(), 'uploads', 'rider-documents');
    if (!existsSync(uploadDir)) mkdirSync(uploadDir, { recursive: true });
    const fileName = `${randomUUID()}${extension}`;
    writeFileSync(join(uploadDir, fileName), file.buffer);
    const publicBaseUrl = process.env.RIDER_SERVICE_PUBLIC_URL || `http://localhost:${process.env.PORT || 3005}`;
    return { 
      success: true, 
      data: { url: `${publicBaseUrl}/uploads/rider-documents/${fileName}` } 
    };
  }

  private extensionFromMime(mimeType: string): string {
    const extension = this.documentExtensions[mimeType];
    if (!extension) {
      throw new BadRequestException('Unsupported document type. Upload PDF, JPG, PNG, or WebP.');
    }
    return extension;
  }
}
