import { Controller, Get, Post, Put, Body, Param, Request } from '@nestjs/common';
import { SellerService } from './seller.service';

@Controller('sellers')
export class SellerController {
  constructor(private readonly sellerService: SellerService) {}

  @Post('onboard')
  async create(@Body() sellerData: any) {
    const seller = await this.sellerService.create(sellerData);
    return { success: true, data: seller };
  }

  @Post('upload-document')
  async uploadDocument(@Body() data: any) {
    // In a full implementation, we would process the file and return an S3/Cloudinary URL
    // For now, return a placeholder URL
    return { success: true, data: { url: "https://via.placeholder.com/300x400.png?text=Verified+Document" } };
  }

  @Get('me')
  async findMe(@Request() req: any) {
    try {
        const userId = req.user?.id || "dummy";
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

  @Get('stall/:stallId/qr')
  async getQrCode(@Param('stallId') stallId: string) {
    const qrUrl = await this.sellerService.generateQrCode(stallId);
    return { success: true, data: { qrUrl } };
  }
}
