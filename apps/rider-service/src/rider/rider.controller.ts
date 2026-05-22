import {
  Controller,
  Get,
  Post,
  Put,
  Patch,
  Body,
  Param,
  Request,
  Query,
  UseInterceptors,
  UploadedFile,
  BadRequestException,
  UseGuards,
  ForbiddenException,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { randomUUID } from 'crypto';
import { existsSync, mkdirSync, writeFileSync } from 'fs';
import { join } from 'path';
import { RiderService } from './rider.service';
import type { Coordinates } from '@rmf/location';
import { Roles, JwtAuthGuard } from '@rmf/auth';
import { UserRole } from '@rmf/shared-types';

@Controller('riders')
export class RiderController {
  constructor(private readonly riderService: RiderService) {}

  private readonly documentExtensions: Record<string, string> = {
    'application/pdf': '.pdf',
    'image/jpeg': '.jpg',
    'image/png': '.png',
    'image/webp': '.webp',
  };

  @UseGuards(JwtAuthGuard)
  @Post('register')
  async create(@Request() req: any, @Body() riderData: any) {
    const userId = req.user?.userId;
    if (!userId) {
      throw new BadRequestException('User ID is required. Please log in before registering as a rider.');
    }
    const rider = await this.riderService.create({ ...riderData, userId });
    return { success: true, data: rider };
  }

  // FIX [RIDER-ME]: Removed queryUserId fallback — prevents IDOR.
  @UseGuards(JwtAuthGuard)
  @Get('me')
  async findMe(@Request() req: any) {
    try {
      const userId = req.user?.userId;
      if (!userId) return { success: true, data: null };
      const rider = await this.riderService.findByUserId(userId);
      return { success: true, data: rider };
    } catch (e) {
      return { success: true, data: null };
    }
  }

  // FIX [RIDER-STATUS]: Removed body.userId fallback — only JWT identity used.
  @UseGuards(JwtAuthGuard)
  @Patch('me/status')
  async updateMyStatus(@Request() req: any, @Body() data: { isActive: boolean; location?: Coordinates }) {
    const userId = req.user?.userId;
    if (!userId) throw new ForbiddenException('Authentication required');
    const rider = await this.riderService.updateStatus(userId, data.isActive, data.location);
    return { success: true, data: rider };
  }

  // FIX [RIDER-LOCATION]: Removed body.userId fallback.
  @UseGuards(JwtAuthGuard)
  @Patch('me/location')
  async updateMyLocation(@Request() req: any, @Body() data: { lat: number; lng: number }) {
    const userId = req.user?.userId;
    if (!userId) throw new ForbiddenException('Authentication required');
    const rider = await this.riderService.updateLocation(userId, data);
    return { success: true, data: rider };
  }

  @UseGuards(JwtAuthGuard)
  @Roles(UserRole.RIDER)
  @Post('settings/change-request')
  async createSettingsChangeRequest(@Request() req: any, @Body() body: any) {
    const request = await this.riderService.createSettingsChangeRequest(req.user.userId, body || {});
    return { success: true, data: request };
  }

  @UseGuards(JwtAuthGuard)
  @Roles(UserRole.ADMIN)
  @Get('settings/change-requests')
  async listSettingsChangeRequests(@Query('status') status?: string) {
    const requests = await this.riderService.listSettingsChangeRequests(status || 'PENDING');
    return { success: true, data: requests };
  }

  @UseGuards(JwtAuthGuard)
  @Roles(UserRole.ADMIN)
  @Post('settings/change-requests/:id/approve')
  async approveSettingsChangeRequest(@Param('id') id: string, @Request() req: any, @Body() body?: { notes?: string }) {
    const request = await this.riderService.approveSettingsChangeRequest(id, req.user.userId, body?.notes);
    return { success: true, data: request };
  }

  @UseGuards(JwtAuthGuard)
  @Roles(UserRole.ADMIN)
  @Post('settings/change-requests/:id/reject')
  async rejectSettingsChangeRequest(@Param('id') id: string, @Request() req: any, @Body() body?: { notes?: string }) {
    const request = await this.riderService.rejectSettingsChangeRequest(id, req.user.userId, body?.notes);
    return { success: true, data: request };
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

  @UseGuards(JwtAuthGuard)
  @Put('user/:userId/status')
  async updateStatus(
    @Param('userId') userId: string,
    @Body() data: { isActive: boolean; location?: Coordinates },
    @Request() req: any,
  ) {
    if (req.user.userId !== userId && req.user.role !== 'ADMIN') {
      throw new ForbiddenException('You can only update your own status');
    }
    const rider = await this.riderService.updateStatus(userId, data.isActive, data.location);
    return { success: true, data: rider };
  }

  @UseGuards(JwtAuthGuard)
  @Put('user/:userId/location')
  async updateLocation(
    @Param('userId') userId: string,
    @Body() location: Coordinates,
    @Request() req: any,
  ) {
    if (req.user.userId !== userId && req.user.role !== 'ADMIN') {
      throw new ForbiddenException('You can only update your own location');
    }
    const rider = await this.riderService.updateLocation(userId, location);
    return { success: true, data: rider };
  }

  @Get()
  async findAll(@Query('isApproved') isApproved?: string) {
    const riders = await this.riderService.findAll(
      isApproved === 'true' || isApproved === 'false' ? isApproved === 'true' : undefined,
    );
    return { success: true, data: riders };
  }

  // FIX [RIDER-APPROVE]: Was unauthenticated — anyone could approve rider applications.
  @UseGuards(JwtAuthGuard)
  @Roles(UserRole.ADMIN)
  @Post(':id/approve')
  async approve(@Param('id') id: string) {
    const rider = await this.riderService.approve(id);
    return { success: true, data: rider };
  }

  // FIX [RIDER-REJECT]: Was unauthenticated — anyone could reject riders.
  @UseGuards(JwtAuthGuard)
  @Roles(UserRole.ADMIN)
  @Post(':id/reject')
  async reject(@Param('id') id: string, @Body() body?: { reason?: string }) {
    const rider = await this.riderService.reject(id, body?.reason);
    return { success: true, data: rider };
  }

  // FIX [RIDER-UPLOAD]: Was unauthenticated — anyone could upload documents.
  @UseGuards(JwtAuthGuard)
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
      data: { url: `${publicBaseUrl}/uploads/rider-documents/${fileName}` },
    };
  }

  @Get('nearby')
  async getNearbyRiders(
    @Query('lat') lat: string,
    @Query('lng') lng: string,
    @Query('radius') radius?: string,
  ) {
    const latNum = Number(lat);
    const lngNum = Number(lng);
    const radiusNum = radius ? Number(radius) : 5000;

    if (!Number.isFinite(latNum) || !Number.isFinite(lngNum)) {
      throw new BadRequestException('lat and lng query parameters must be valid numbers');
    }

    const nearby = await this.riderService.findNearbyRiders(latNum, lngNum, radiusNum);
    return { success: true, data: nearby };
  }

  private extensionFromMime(mimeType: string): string {
    const extension = this.documentExtensions[mimeType];
    if (!extension) {
      throw new BadRequestException('Unsupported document type. Upload PDF, JPG, PNG, or WebP.');
    }
    return extension;
  }
}
