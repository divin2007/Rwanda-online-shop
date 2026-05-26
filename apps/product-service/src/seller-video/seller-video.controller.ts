import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  Request,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { randomUUID } from 'crypto';
import { JwtAuthGuard, Public, Roles } from '@rmf/auth';
import { UserRole } from '@rmf/shared-types';
import { StorageService } from '../storage/storage.service';
import { SellerVideoService } from './seller-video.service';

@Controller('seller-videos')
export class SellerVideoController {
  constructor(
    private readonly sellerVideoService: SellerVideoService,
    private readonly storageService: StorageService,
  ) {}

  private readonly videoExtensions: Record<string, string> = {
    'video/mp4': '.mp4',
    'video/webm': '.webm',
    'video/quicktime': '.mov',
    'video/x-m4v': '.m4v',
  };

  @UseGuards(JwtAuthGuard)
  @Roles(UserRole.SELLER, UserRole.ADMIN)
  @Post('upload')
  @UseInterceptors(FileInterceptor('file', { limits: { fileSize: 80 * 1024 * 1024 } }))
  async uploadVideo(@UploadedFile() file: any) {
    if (!file) {
      throw new BadRequestException('No video file uploaded');
    }
    const extension = this.videoExtensions[file.mimetype];
    if (!extension) {
      throw new BadRequestException('Unsupported video type. Upload MP4, WebM, MOV, or M4V.');
    }
    const fileName = `${randomUUID()}${extension}`;
    const url = await this.storageService.uploadFile(file.buffer, fileName, file.mimetype, 'seller-videos');
    return { success: true, data: { url } };
  }

  @UseGuards(JwtAuthGuard)
  @Roles(UserRole.SELLER, UserRole.ADMIN)
  @Post()
  async create(@Request() req: any, @Body() body: any) {
    const video = await this.sellerVideoService.create(req.user, body || {});
    return { success: true, data: video };
  }

  @Public()
  @Get('stories/personalized')
  async getPersonalizedStories(@Request() req: any, @Query() query: any) {
    const stories = await this.sellerVideoService.getPersonalizedStories(req.user, query || {});
    return { success: true, data: stories };
  }

  @Public()
  @Get()
  async findAll(@Query() query: any, @Request() req: any) {
    const viewerId = req.user?.userId;
    const videos = await this.sellerVideoService.findAll(query || {}, viewerId);
    return { success: true, data: videos };
  }

  @UseGuards(JwtAuthGuard)
  @Roles(UserRole.ADMIN)
  @Get('admin/moderation')
  async moderationQueue(@Query() query: any, @Request() req: any) {
    const videos = await this.sellerVideoService.findAll({ ...(query || {}), adminTrusted: true }, req.user?.userId);
    return { success: true, data: videos };
  }

  @UseGuards(JwtAuthGuard)
  @Roles(UserRole.ADMIN)
  @Patch(':id/moderation')
  async moderate(@Request() req: any, @Param('id') id: string, @Body() body: any) {
    const video = await this.sellerVideoService.moderate(req.user, id, body || {});
    return { success: true, data: video };
  }

  @Public()
  @Get(':id')
  async findById(@Param('id') id: string, @Request() req: any) {
    const video = await this.sellerVideoService.findById(id, true, req.user?.userId);
    return { success: true, data: video };
  }

  @UseGuards(JwtAuthGuard)
  @Roles(UserRole.SELLER, UserRole.ADMIN)
  @Patch(':id')
  async update(@Request() req: any, @Param('id') id: string, @Body() body: any) {
    const video = await this.sellerVideoService.update(req.user, id, body || {});
    return { success: true, data: video };
  }

  @UseGuards(JwtAuthGuard)
  @Roles(UserRole.SELLER, UserRole.ADMIN)
  @Delete(':id')
  async remove(@Request() req: any, @Param('id') id: string) {
    const result = await this.sellerVideoService.remove(req.user, id);
    return { success: true, data: result };
  }

  @UseGuards(JwtAuthGuard)
  @Post(':id/reaction')
  async react(@Request() req: any, @Param('id') id: string, @Body('reaction') reaction: 'like' | 'dislike' | 'none') {
    const video = await this.sellerVideoService.react(req.user, id, reaction);
    return { success: true, data: video };
  }

  @UseGuards(JwtAuthGuard)
  @Post(':id/comments')
  async comment(@Request() req: any, @Param('id') id: string, @Body() body: any) {
    const video = await this.sellerVideoService.comment(req.user, id, body || {});
    return { success: true, data: video };
  }
}
