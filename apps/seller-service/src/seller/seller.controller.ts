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
  BadRequestException,
  UseInterceptors,
  UploadedFile,
  UseGuards,
  ForbiddenException,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { randomUUID } from 'crypto';
import { existsSync, mkdirSync, writeFileSync } from 'fs';
import { join } from 'path';
import { SellerService } from './seller.service';
import { Roles, JwtAuthGuard, Public } from '@rmf/auth';
import { UserRole } from '@rmf/shared-types';

@Controller('sellers')
export class SellerController {
  constructor(private readonly sellerService: SellerService) { }

  private readonly documentExtensions: Record<string, string> = {
    'application/pdf': '.pdf',
    'image/jpeg': '.jpg',
    'image/png': '.png',
    'image/webp': '.webp',
  };

  // Public, PII-safe seller discovery (logged-out visitors browse food/dining sellers).
  @Public()
  @Get('discover')
  async discover(@Query('businessType') businessType?: string) {
    const filter: any = {};
    if (businessType) {
      const types = businessType.split(',').map((t) => t.trim().toUpperCase()).filter(Boolean);
      if (types.length === 1) filter.businessType = types[0];
      else if (types.length > 1) filter.businessType = { $in: types };
    }
    const sellers = await this.sellerService.findPublic(filter);
    return { success: true, data: sellers };
  }

  // Authenticated read — admin and internal services need the full seller list.
  @Get()
  async findAll(
    @Query('isApproved') isApproved?: string,
    @Query('businessType') businessType?: string,
  ) {
    const filter: any = {};
    if (isApproved !== undefined) {
      filter.isApproved = isApproved === 'true';
    }
    if (businessType) {
      const types = businessType
        .split(',')
        .map((t) => t.trim().toUpperCase())
        .filter(Boolean);
      if (types.length === 1) filter.businessType = types[0];
      else if (types.length > 1) filter.businessType = { $in: types };
    }
    const sellers = await this.sellerService.findAll(filter);
    return { success: true, data: sellers };
  }

  // Update businessType for the authenticated seller (enum-validated server-side).
  @UseGuards(JwtAuthGuard)
  @Patch('me/business-type')
  async updateBusinessType(@Request() req: any, @Body() body: { businessType?: string }) {
    const userId = req.user?.userId;
    if (!userId) {
      throw new BadRequestException('Authentication required');
    }
    const seller = await this.sellerService.updateBusinessType(userId, body?.businessType || '');
    return { success: true, data: seller };
  }

  @UseGuards(JwtAuthGuard)
  @Post('onboard')
  async create(@Request() req: any, @Body() sellerData: any) {
    const userId = req.user?.userId;
    if (!userId) {
      throw new BadRequestException('User ID is required. Please log in before onboarding.');
    }
    const seller = await this.sellerService.create({ ...sellerData, userId });
    return { success: true, data: seller };
  }

  // FIX [SELLER-UPLOAD]: Was unauthenticated — anyone could upload arbitrary files.
  @UseGuards(JwtAuthGuard)
  @Post('upload-document')
  @UseInterceptors(FileInterceptor('file', { limits: { fileSize: 8 * 1024 * 1024 } }))
  async uploadDocument(@UploadedFile() file: any) {
    if (!file) {
      throw new BadRequestException('No document file uploaded');
    }
    const extension = this.extensionFromMime(file.mimetype);
    const uploadDir = join(process.cwd(), 'uploads', 'seller-documents');
    if (!existsSync(uploadDir)) mkdirSync(uploadDir, { recursive: true });
    const fileName = `${randomUUID()}${extension}`;
    writeFileSync(join(uploadDir, fileName), file.buffer);
    const publicBaseUrl = process.env.SELLER_SERVICE_PUBLIC_URL || `http://localhost:${process.env.PORT || 3004}`;
    return { success: true, data: { url: `${publicBaseUrl}/uploads/seller-documents/${fileName}` } };
  }

  private extensionFromMime(mimeType: string): string {
    const extension = this.documentExtensions[mimeType];
    if (!extension) {
      throw new BadRequestException('Unsupported document type. Upload PDF, JPG, PNG, or WebP.');
    }
    return extension;
  }

  // FIX [SELLER-ME]: Removed queryUserId fallback — prevents IDOR bypass.
  @UseGuards(JwtAuthGuard)
  @Get('me')
  async findMe(@Request() req: any) {
    try {
      const userId = req.user?.userId;
      if (!userId) {
        return { success: true, data: null };
      }
      const seller = await this.sellerService.findByUserId(userId);
      return { success: true, data: seller };
    } catch (e) {
      return { success: true, data: null };
    }
  }

  @Get('user/:userId')
  async findByUserId(@Param('userId') userId: string) {
    const seller = await this.sellerService.findByUserId(userId);
    return { success: true, data: seller };
  }

  // FIX [SELLER-UPDATE]: Added ownership check — sellers can only update their own profile.
  @UseGuards(JwtAuthGuard)
  @Put('user/:userId')
  async update(@Param('userId') userId: string, @Body() updateData: any, @Request() req: any) {
    if (req.user.userId !== userId && req.user.role !== 'ADMIN') {
      throw new ForbiddenException('You can only update your own seller profile');
    }
    const seller = await this.sellerService.update(userId, updateData);
    return { success: true, data: seller };
  }

  // FIX [SELLER-APPROVE]: Was unauthenticated — anyone could approve seller applications.
  // Now requires ADMIN role.
  @UseGuards(JwtAuthGuard)
  @Roles(UserRole.SELLER)
  @Post('settings/change-request')
  async createSettingsChangeRequest(@Request() req: any, @Body() body: any) {
    const request = await this.sellerService.createSettingsChangeRequest(req.user.userId, body || {});
    return { success: true, data: request };
  }

  @UseGuards(JwtAuthGuard)
  @Roles(UserRole.ADMIN)
  @Get('settings/change-requests')
  async listSettingsChangeRequests(@Query('status') status?: string) {
    const requests = await this.sellerService.listSettingsChangeRequests(status || 'PENDING');
    return { success: true, data: requests };
  }

  @UseGuards(JwtAuthGuard)
  @Roles(UserRole.ADMIN)
  @Post('settings/change-requests/:id/approve')
  async approveSettingsChangeRequest(@Param('id') id: string, @Request() req: any, @Body() body?: { notes?: string }) {
    const request = await this.sellerService.approveSettingsChangeRequest(id, req.user.userId, body?.notes);
    return { success: true, data: request };
  }

  @UseGuards(JwtAuthGuard)
  @Roles(UserRole.ADMIN)
  @Post('settings/change-requests/:id/reject')
  async rejectSettingsChangeRequest(@Param('id') id: string, @Request() req: any, @Body() body?: { notes?: string }) {
    const request = await this.sellerService.rejectSettingsChangeRequest(id, req.user.userId, body?.notes);
    return { success: true, data: request };
  }

  @UseGuards(JwtAuthGuard)
  @Roles(UserRole.ADMIN)
  @Post(':id/approve')
  async approve(@Param('id') id: string) {
    const seller = await this.sellerService.approve(id);
    return { success: true, data: seller };
  }

  // FIX [SELLER-DECLINE]: Was unauthenticated — anyone could reject sellers.
  @UseGuards(JwtAuthGuard)
  @Roles(UserRole.ADMIN)
  @Post(':id/decline')
  async decline(@Param('id') id: string) {
    const seller = await this.sellerService.reject(id);
    return { success: true, data: seller };
  }

  @Get('stall/:stallId/qr')
  async getQrCode(@Param('stallId') stallId: string) {
    const qrUrl = await this.sellerService.generateQrCode(stallId);
    return { success: true, data: { qrUrl } };
  }

  // ── Seller Certification Tiers (Feature 11) ──────────────────────────────
  // Authenticated seller's own tier + progress. Path: /api/v1/sellers/me/tier
  @UseGuards(JwtAuthGuard)
  @Roles(UserRole.SELLER)
  @Get('me/tier')
  async getMyTier(@Request() req: any) {
    const data = await this.sellerService.getMyTier(req.user.userId);
    return { success: true, data };
  }

  // Public tier snapshot. Path: /api/v1/sellers/:id/tier
  @Public()
  @Get(':id/tier')
  async getSellerTier(@Param('id') id: string) {
    const data = await this.sellerService.getPublicTier(id);
    return { success: true, data };
  }

  // ── Affiliate application review (Feature 3, seller side) ────────────────
  @UseGuards(JwtAuthGuard)
  @Roles(UserRole.SELLER)
  @Get('affiliates/applications')
  async listAffiliateApplications(@Request() req: any, @Query('status') status?: string) {
    const data = await this.sellerService.listAffiliateApplications(req.user.userId, status || 'pending');
    return { success: true, data };
  }

  @UseGuards(JwtAuthGuard)
  @Roles(UserRole.SELLER)
  @Patch('affiliates/applications/:id/approve')
  async approveAffiliateApplication(@Request() req: any, @Param('id') id: string, @Body() body?: { commissionRate?: number }) {
    const data = await this.sellerService.approveAffiliateApplication(req.user.userId, id, body?.commissionRate);
    return { success: true, data };
  }

  @UseGuards(JwtAuthGuard)
  @Roles(UserRole.SELLER)
  @Patch('affiliates/applications/:id/reject')
  async rejectAffiliateApplication(@Request() req: any, @Param('id') id: string, @Body() body?: { reviewNote?: string }) {
    const data = await this.sellerService.rejectAffiliateApplication(req.user.userId, id, body?.reviewNote);
    return { success: true, data };
  }
}
