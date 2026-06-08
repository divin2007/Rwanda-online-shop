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
  UnauthorizedException,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { randomUUID } from 'crypto';
import { existsSync, mkdirSync, writeFileSync } from 'fs';
import { extname, join } from 'path';
import { DeliveryService } from './delivery.service';
import type { Coordinates } from '@rmf/location';
import { DeliveryStatus, UserRole } from '@rmf/shared-types';
import { Public, JwtAuthGuard, Roles } from '@rmf/auth';

function verifyInternalSecret(req: any): boolean {
  const secret = process.env.INTERNAL_SERVICE_SECRET;
  if (!secret) {
    throw new ForbiddenException('INTERNAL_SERVICE_SECRET must be configured for internal delivery-service access');
  }
  const provided = req.headers?.['x-internal-service-key'] || req.headers?.['x-internal-secret'];
  if (provided !== secret) {
    throw new ForbiddenException('Valid internal service key required');
  }
  return true;
}

function getInternalOrJwtActor(req: any): { isInternal: boolean; userId?: string; role?: string } {
  const provided = req.headers?.['x-internal-service-key'] || req.headers?.['x-internal-secret'];
  const secret = process.env.INTERNAL_SERVICE_SECRET;
  if (provided || secret) {
    if (secret && provided === secret) return { isInternal: true, role: 'INTERNAL' };
    if (provided) throw new ForbiddenException('Valid internal service key required');
  }

  const authHeader = req.headers?.authorization || '';
  if (!authHeader.startsWith('Bearer ')) {
    throw new UnauthorizedException('Authentication is required to view this delivery');
  }

  try {
    const jwt = require('jsonwebtoken');
    if (process.env.NODE_ENV === 'production' && !process.env.JWT_SECRET) {
      throw new Error('JWT_SECRET is not configured');
    }
    const decoded = jwt.verify(authHeader.substring(7), process.env.JWT_SECRET || 'dev-secret-change-in-prod');
    const userId = decoded?.sub || decoded?.userId || decoded?.id;
    if (!userId) throw new Error('JWT is missing a subject');
    return { isInternal: false, userId: String(userId), role: String(decoded?.role || '') };
  } catch {
    throw new UnauthorizedException('Invalid or expired authentication token');
  }
}

@Controller('deliveries')
export class DeliveryController {
  constructor(private readonly deliveryService: DeliveryService) {}

  @Public()
  @Post('fee')
  async calculateFee(@Body() data: { from: Coordinates; to: Coordinates; weightFactor?: number }, @Request() req: any) {
    getInternalOrJwtActor(req);
    const feeInfo = await this.deliveryService.calculateDeliveryFee(data.from, data.to, data.weightFactor);
    return { success: true, data: feeInfo };
  }

  @UseGuards(JwtAuthGuard)
  @Roles(UserRole.RIDER, UserRole.ADMIN)
  @Get('available')
  async getAvailable() {
    const deliveries = await this.deliveryService.getAvailableDeliveries();
    return { success: true, data: deliveries };
  }

  // FIX [DELIVERY-ACTIVE]: Removed queryUserId fallback — prevents IDOR.
  @UseGuards(JwtAuthGuard)
  @Get('active')
  async getActive(@Request() req: any) {
    const userId = req.user?.userId;
    if (!userId) return { success: true, data: null };
    const delivery = await this.deliveryService.getActiveDelivery(userId);
    return { success: true, data: delivery };
  }

  // FIX [DELIVERY-HISTORY]: Removed queryUserId fallback — prevents IDOR.
  @UseGuards(JwtAuthGuard)
  @Get('history')
  async getHistory(@Request() req: any) {
    const userId = req.user?.userId;
    if (!userId) return { success: true, data: [] };
    const history = await this.deliveryService.getHistory(userId);
    return { success: true, data: history };
  }

  @UseGuards(JwtAuthGuard)
  @Get('rider/:userId')
  async getRiderDeliveries(@Param('userId') userId: string, @Query('status') status: string, @Request() req: any) {
    if (req.user.role !== 'ADMIN' && req.user.userId !== userId) {
      throw new ForbiddenException('You can only view your own deliveries');
    }
    const deliveries = await this.deliveryService.getRiderDeliveries(userId, status);
    return { success: true, data: deliveries };
  }

  @Public()
  @Get(':id')
  async getDeliveryById(@Param('id') id: string, @Request() req: any) {
    const actor = getInternalOrJwtActor(req);
    const delivery = await this.deliveryService.getDeliveryById(id);
    if (!actor.isInternal && !(await this.deliveryService.canUserViewDelivery(delivery, actor.userId!, actor.role))) {
      throw new ForbiddenException('You can only view deliveries attached to your own orders');
    }
    return { success: true, data: delivery };
  }

  @Public()
  @Post()
  async create(@Body() data: any, @Request() req: any) {
    verifyInternalSecret(req);
    const delivery = await this.deliveryService.createDelivery(data);
    return { success: true, data: delivery };
  }

  @UseGuards(JwtAuthGuard)
  @Roles(UserRole.RIDER)
  @Patch(':id/accept')
  async accept(@Param('id') id: string, @Request() req: any) {
    const delivery = await this.deliveryService.acceptDelivery(id, req.user.userId);
    return { success: true, data: delivery };
  }

  @UseGuards(JwtAuthGuard)
  @Roles(UserRole.RIDER, UserRole.ADMIN)
  @Patch(':id/reject')
  async reject(@Param('id') id: string, @Request() req: any) {
    const delivery = await this.deliveryService.rejectDelivery(id, req.user?.userId, req.user?.role);
    return { success: true, data: delivery };
  }

  @UseGuards(JwtAuthGuard)
  @Post(':id/rebroadcast')
  async rebroadcast(@Param('id') id: string, @Request() req: any) {
    const role = String(req.user?.role || '').toUpperCase();
    if (role !== 'SELLER' && role !== 'ADMIN') {
      throw new ForbiddenException('Only sellers or admins can rebroadcast delivery requests');
    }
    const delivery = await this.deliveryService.rebroadcastDelivery(id);
    return { success: true, data: delivery };
  }

  @UseGuards(JwtAuthGuard)
  @Patch(':id/complete')
  async complete(@Param('id') id: string, @Request() req: any) {
    const delivery = await this.deliveryService.completeDelivery(id, req.user?.userId);
    return { success: true, data: delivery };
  }

  @UseGuards(JwtAuthGuard)
  @Post(':id/scan-qr')
  async scanQr(@Param('id') id: string, @Body() data: { qrData?: string; stallId?: string; photoUrl?: string }, @Request() req: any) {
    const scannedPayload = data.qrData || '';
    const delivery = await this.deliveryService.photoVerifiedPickup(id, data.photoUrl || '', scannedPayload, req.user?.userId);
    return { success: true, data: delivery };
  }

  // FIX [DELIVERY-PHOTO]: Was unauthenticated — anyone could upload files.
  @UseGuards(JwtAuthGuard)
  @Post(':id/pickup-photo')
  @UseInterceptors(FileInterceptor('file'))
  async uploadPhoto(@UploadedFile() file: any) {
    if (!file) {
      throw new BadRequestException('No photo file uploaded');
    }
    const uploadDir = join(process.cwd(), 'uploads', 'pickup-photos');
    if (!existsSync(uploadDir)) mkdirSync(uploadDir, { recursive: true });
    const extension = extname(file.originalname || '') || this.extensionFromMime(file.mimetype);
    const fileName = `${randomUUID()}${extension}`;
    writeFileSync(join(uploadDir, fileName), file.buffer);
    const port = (process.env.PORT && process.env.PORT !== '3000') ? process.env.PORT : 3008;
    const publicBaseUrl = process.env.DELIVERY_SERVICE_PUBLIC_URL || `http://localhost:${port}`;
    return { success: true, data: { url: `${publicBaseUrl}/uploads/pickup-photos/${fileName}` } };
  }

  private extensionFromMime(mimeType: string): string {
    const extensions: Record<string, string> = {
      'image/jpeg': '.jpg',
      'image/png': '.png',
      'image/webp': '.webp',
      'image/gif': '.gif',
    };
    return extensions[mimeType] || '.bin';
  }

  @UseGuards(JwtAuthGuard)
  @Put(':id/status')
  async updateStatus(@Param('id') id: string, @Body() body: { status: DeliveryStatus }, @Request() req: any) {
    const delivery = await this.deliveryService.updateStatus(id, body.status, req.user?.userId);
    return { success: true, data: delivery };
  }

  @Public()
  @Put(':id/internal/status')
  async updateStatusInternal(@Param('id') id: string, @Body() body: { status: DeliveryStatus }, @Request() req: any) {
    verifyInternalSecret(req);
    const delivery = await this.deliveryService.updateStatus(id, body.status, 'internal-service');
    return { success: true, data: delivery };
  }

  @UseGuards(JwtAuthGuard)
  @Post(':id/pickup')
  async pickup(@Param('id') id: string, @Body() body: { photoUrl: string; qrData: string }, @Request() req: any) {
    const delivery = await this.deliveryService.photoVerifiedPickup(id, body.photoUrl, body.qrData, req.user?.userId);
    return { success: true, data: delivery };
  }

  @UseGuards(JwtAuthGuard)
  @Roles(UserRole.RIDER, UserRole.ADMIN)
  @Post(':id/location')
  async streamLocation(@Param('id') id: string, @Body() coords: Coordinates, @Request() req: any) {
    const delivery = await this.deliveryService.streamLocation(id, coords, req.user?.userId, req.user?.role);
    return { success: true, data: delivery };
  }

  @UseGuards(JwtAuthGuard)
  @Post(':id/handover')
  async confirmHandover(@Param('id') id: string, @Body() body: { role: 'seller' | 'rider' }, @Request() req: any) {
    const jwtRole = String(req.user?.role || '').toUpperCase();
    const role = jwtRole === 'RIDER' ? 'rider' : jwtRole === 'SELLER' ? 'seller' : body.role;
    const delivery = await this.deliveryService.confirmHandover(id, role, req.user?.userId, jwtRole);
    return { success: true, data: delivery };
  }
}
