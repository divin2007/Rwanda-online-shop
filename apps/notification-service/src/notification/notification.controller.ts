import { Controller, Get, Post, Body, Param } from '@nestjs/common';
import { NotificationService } from './notification.service';

@Controller('notifications')
export class NotificationController {
  constructor(private readonly notificationService: NotificationService) {}

  @Post('sms')
  async sendSms(@Body() body: { userId: string, phone: string, type: string, params: any, lang?: 'rw'|'en' }) {
    const result = await this.notificationService.sendSms(body.userId, body.phone, body.type, body.params, body.lang);
    return { success: true, data: result };
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
}
