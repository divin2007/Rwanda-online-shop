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

  @Get('me')
  async findMe(@Request() req: any) {
    // In a full implementation, we extract user.id from the JWT in req.user
    // For now, we'll return a 404 or mock if user is not present
    if (!req.user) {
        // Return first seller for testing if no auth yet
        const sellers = await this.sellerService.findByUserId("dummy"); 
        return { success: true, data: sellers };
    }
    const seller = await this.sellerService.findByUserId(req.user.id);
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
