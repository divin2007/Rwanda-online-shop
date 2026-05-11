import { Controller, Get, Post, Body, Param, Request, Query, Put } from '@nestjs/common';
import { NotificationService } from './notification.service';

@Controller('notifications')
export class NotificationController {
  constructor(private readonly notificationService: NotificationService) {}

  @Post('sms')
  async sendSms(@Body() body: { userId: string, phone: string, type: string, params: any, lang?: 'rw'|'en' }) {
    const result = await this.notificationService.sendSms(body.userId, body.phone, body.type, body.params, body.lang);
    return { success: true, data: result };
  }

  @Get('me')
  async getMyNotifications(@Request() req: any, @Query('userId') queryUserId?: string) {
    const userId = req.user?.userId || queryUserId;
    if (!userId) return { success: true, data: [] };
    const logs = await this.notificationService.getLogs(userId);
    return { success: true, data: logs };
  }

  @Post('email')
  async sendEmail(@Body() body: { userId: string, email: string, type: string, params: any, lang?: 'rw'|'en' }) {
    const result = await this.notificationService.sendEmail(body.userId, body.email, body.type, body.params, body.lang);
    return { success: true, data: result };
  }

  @Get('user/:userId')
  async getLogs(@Param('userId') userId: string) {
    const logs = await this.notificationService.getLogs(userId);
    return { success: true, data: logs };
  }

  @Post('in-app')
  async sendInApp(@Body() body: { userId: string, type: string, params: any, lang?: 'rw'|'en' }) {
    const result = await this.notificationService.sendInApp(body.userId, body.type, body.params, body.lang);
    return { success: true, data: result };
  }

  @Get('unread-count')
  async getUnreadCount(@Query('userId') userId: string) {
    const count = await this.notificationService.getUnreadCount(userId);
    return { success: true, count };
  }

  @Put('read/:id')
  async markAsRead(@Param('id') id: string, @Body('userId') userId: string) {
    const result = await this.notificationService.markAsRead(id, userId);
    return { success: true, data: result };
  }

  @Put('read-all')
  async markAllAsRead(@Body('userId') userId: string) {
    await this.notificationService.markAllAsRead(userId);
    return { success: true };
  }
}
