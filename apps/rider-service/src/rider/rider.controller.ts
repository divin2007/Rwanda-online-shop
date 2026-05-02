import { Controller, Get, Post, Put, Body, Param } from '@nestjs/common';
import { RiderService } from './rider.service';
import { Coordinates } from '@rmf/location';

@Controller('riders')
export class RiderController {
  constructor(private readonly riderService: RiderService) {}

  @Post('register')
  async create(@Body() riderData: any) {
    const rider = await this.riderService.create(riderData);
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
