import { Controller, Get, Post, Put, Body, Param } from '@nestjs/common';
import { SellerService } from './seller.service';

@Controller('sellers')
export class SellerController {
  constructor(private readonly sellerService: SellerService) {}

  @Post('onboard')
  async create(@Body() sellerData: any) {
    const seller = await this.sellerService.create(sellerData);
    return { success: true, data: seller };
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
