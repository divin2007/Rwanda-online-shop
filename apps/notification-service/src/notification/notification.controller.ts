import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Request,
  Query,
  Put,
  UseGuards,
  ForbiddenException,
  UnauthorizedException,
} from '@nestjs/common';
import { NotificationService } from './notification.service';
import { JwtAuthGuard, Public } from '@rmf/auth';

/**
 * SECURITY: Internal microservice calls (from order-service, delivery-service etc.)
 * use a shared secret header instead of a user JWT. This guards all internal-only
 * dispatch endpoints without exposing them to the public internet.
 */
function verifyInternalSecret(req: any): void {
  const secret = process.env.INTERNAL_SERVICE_SECRET;
  if (!secret) {
    throw new UnauthorizedException('INTERNAL_SERVICE_SECRET must be configured for internal notification-service access');
  }
  const provided = req.headers?.['x-internal-service-key'];
  if (provided !== secret) {
    throw new UnauthorizedException('Invalid internal service key');
  }
}

@Controller('notifications')
export class NotificationController {
  constructor(private readonly notificationService: NotificationService) {}

  // FIX [NOTIF-SMS]: Was fully public — any caller could drain SMS budget.
  // Now requires X-Internal-Service-Key from trusted backend services only.
  @Public()
  @Post('sms')
  async sendSms(@Body() body: { userId: string; phone: string; type: string; params: any; lang?: 'rw' | 'en' }, @Request() req: any) {
    verifyInternalSecret(req);
    const result = await this.notificationService.sendSms(body.userId, body.phone, body.type, body.params, body.lang);
    return { success: true, data: result };
  }

  @Public()
  @Post('whatsapp')
  async sendWhatsApp(@Body() body: { userId: string; phone: string; type: string; params: any; lang?: 'rw' | 'en' }, @Request() req: any) {
    verifyInternalSecret(req);
    const result = await this.notificationService.sendWhatsApp(body.userId, body.phone, body.type, body.params, body.lang);
    return { success: true, data: result };
  }

  // FIX [NOTIF-EMAIL]: Was fully public — anyone could send phishing emails via our domain.
  @Public()
  @Post('email')
  async sendEmail(@Body() body: { userId: string; email: string; type: string; params: any; lang?: 'rw' | 'en' }, @Request() req: any) {
    verifyInternalSecret(req);
    const result = await this.notificationService.sendEmail(body.userId, body.email, body.type, body.params, body.lang);
    return { success: true, data: result };
  }

  // FIX [NOTIF-INAPP]: Was fully public — anyone could push fake in-app notifications.
  @Public()
  @Post('in-app')
  async sendInApp(@Body() body: { userId: string; type: string; params: any; lang?: 'rw' | 'en' }, @Request() req: any) {
    verifyInternalSecret(req);
    const result = await this.notificationService.sendInApp(body.userId, body.type, body.params, body.lang);
    return { success: true, data: result };
  }

  @Public()
  @Post('dispatch')
  async dispatch(@Body() body: {
    userId: string;
    type: string;
    params: any;
    channels?: Array<'IN_APP' | 'EMAIL' | 'SMS' | 'WHATSAPP'>;
    lang?: 'rw' | 'en';
  }, @Request() req: any) {
    verifyInternalSecret(req);
    const result = await this.notificationService.dispatch(body.userId, body.type, body.params || {}, body.channels || ['IN_APP'], body.lang);
    return { success: true, data: result };
  }

  @Public()
  @Post('admin-notify')
  async notifyAdmins(@Body() body: { type: string; params: any }, @Request() req: any) {
    verifyInternalSecret(req);
    await this.notificationService.notifyAdmins(body.type, body.params);
    return { success: true };
  }

  // FIX [NOTIF-ME]: Was reading userId from query param — trivial IDOR bypass.
  // Now reads exclusively from the verified JWT payload.
  @UseGuards(JwtAuthGuard)
  @Get('me')
  async getMyNotifications(@Request() req: any) {
    const userId = req.user.userId;
    const logs = await this.notificationService.getLogs(userId);
    return { success: true, data: logs };
  }

  // FIX [NOTIF-UNREAD]: Was reading userId from query param with no auth.
  @UseGuards(JwtAuthGuard)
  @Get('unread-count')
  async getUnreadCount(@Request() req: any) {
    const count = await this.notificationService.getUnreadCount(req.user.userId);
    return { success: true, count };
  }

  // FIX [NOTIF-IDOR-1]: Was fully unprotected — any caller could read any user's notification log.
  // Now restricted to ADMIN only.
  @UseGuards(JwtAuthGuard)
  @Get('user/:userId')
  async getLogs(@Param('userId') userId: string, @Request() req: any) {
    if (req.user.role !== 'ADMIN') {
      throw new ForbiddenException('Only administrators can access user notification logs');
    }
    const logs = await this.notificationService.getLogs(userId);
    return { success: true, data: logs };
  }

  // FIX [NOTIF-READ]: Was unprotected — anyone could mark anyone's notifications as read.
  // Now requires JWT and verifies the notification belongs to the requester's userId.
  @UseGuards(JwtAuthGuard)
  @Put('read/:id')
  async markAsRead(@Param('id') id: string, @Request() req: any) {
    const result = await this.notificationService.markAsRead(id, req.user.userId);
    return { success: true, data: result };
  }

  // FIX [NOTIF-READ-ALL]: Was unprotected — body userId was trusted blindly.
  @UseGuards(JwtAuthGuard)
  @Put('read-all')
  async markAllAsRead(@Request() req: any) {
    await this.notificationService.markAllAsRead(req.user.userId);
    return { success: true };
  }
}
