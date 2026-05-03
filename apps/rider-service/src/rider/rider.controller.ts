import { Controller, Get, Post, Put, Patch, Body, Param, Request } from '@nestjs/common';
import { RiderService } from './rider.service';
import type { Coordinates } from '@rmf/location';

@Controller('riders')
export class RiderController {
  constructor(private readonly riderService: RiderService) {}

  @Post('register')
  async create(@Body() riderData: any) {
    const rider = await this.riderService.create(riderData);
    return { success: true, data: rider };
  }

  @Get('me')
  async findMe(@Request() req: any) {
    try {
        const userId = req.user?.userId || "65f12345678901234567890a";
        const rider = await this.riderService.findByUserId(userId);
        return { success: true, data: rider };
    } catch (e) {
        return { success: true, data: null };
    }
  }

  @Patch('me/status')
  async updateMyStatus(@Request() req: any, @Body() data: { isActive: boolean, location?: Coordinates }) {
    const userId = req.user?.userId || "65f12345678901234567890a";
    const rider = await this.riderService.updateStatus(userId, data.isActive, data.location);
    return { success: true, data: rider };
  }

  @Patch('me/location')
  async updateMyLocation(@Request() req: any, @Body() location: Coordinates) {
    const userId = req.user?.userId || "65f12345678901234567890a";
    const rider = await this.riderService.updateLocation(userId, location);
    return { success: true, data: rider };
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
}
