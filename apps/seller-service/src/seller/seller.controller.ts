import { Controller, Get, Post, Put, Body, Param, Request, Query, BadRequestException, UseInterceptors, UploadedFile } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { SellerService } from './seller.service';

@Controller('sellers')
export class SellerController {
  constructor(private readonly sellerService: SellerService) {}

  @Get()
  async findAll(@Query('isApproved') isApproved?: string) {
    const filter: any = {};
    if (isApproved !== undefined) {
      filter.isApproved = isApproved === 'true';
    }
    const sellers = await this.sellerService.findAll(filter);
    return { success: true, data: sellers };
  }

  @Post('onboard')
  async create(@Request() req: any, @Body() sellerData: any) {
    // Priority: JWT user > body userId. Never fall back to a hardcoded test ID.
    const userId = req.user?.userId || sellerData.userId;
    if (!userId) {
      throw new BadRequestException('User ID is required. Please log in before onboarding.');
    }
    const seller = await this.sellerService.create({ ...sellerData, userId });
    return { success: true, data: seller };
  }

  @Post('upload-document')
  @UseInterceptors(FileInterceptor('file'))
  async uploadDocument(@UploadedFile() file: any) {
    if (!file) {
      throw new BadRequestException('No document file uploaded');
    }
    const base64 = file.buffer.toString('base64');
    const dataUri = `data:${file.mimetype};base64,${base64}`;
    return { success: true, data: { url: dataUri } };
  }

  @Get('me')
  async findMe(@Request() req: any, @Query('userId') queryUserId?: string) {
    try {
        // Priority: JWT user > query param userId
        const userId = req.user?.userId || queryUserId;
        if (!userId) {
          return { success: true, data: null };
        }
        const seller = await this.sellerService.findByUserId(userId);
        return { success: true, data: seller };
    } catch (e) {
        // Return null data instead of 500/404 to allow frontend to handle onboarding
        return { success: true, data: null };
    }
  }

  @Get('user/:userId')
  async findByUserId(@Param('userId') userId: string) {
    const seller = await this.sellerService.findByUserId(userId);
    return { success: true, data: seller };
  }

  @Put('user/:userId')
  async update(@Param('userId') userId: string, @Body() updateData: any) {
    const seller = await this.sellerService.update(userId, updateData);
    return { success: true, data: seller };
  }

  @Post(':id/approve')
  async approve(@Param('id') id: string) {
    const seller = await this.sellerService.approve(id);
    return { success: true, data: seller };
  }

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
}
