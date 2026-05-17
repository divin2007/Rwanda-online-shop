import { Injectable, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import * as nodemailer from 'nodemailer';

@Injectable()
export class NotificationService {
  private readonly logger = new Logger(NotificationService.name);

  constructor(
    @InjectModel('NotificationLog') private logModel: Model<any>,
    @InjectModel('User') private userModel: Model<any>
  ) {
    this.initTransporter();
  }

  private gateway: any | null = null;

  setGateway(gateway: any) {
    this.gateway = gateway;
  }

  private transporter: nodemailer.Transporter | null = null;

  private readonly defaultNotificationPreferences = {
    inApp: true,
    email: true,
    sms: false,
    whatsapp: false,
    orderUpdates: true,
    promotions: false,
    securityAlerts: true,
    customMessagesEmailOnly: false,
  };

  private initTransporter() {
    const isDev = process.env.NODE_ENV !== 'production';
    if (isDev || process.env.SMTP_HOST) {
      this.transporter = nodemailer.createTransport({
        host: process.env.SMTP_HOST || 'localhost',
        port: Number(process.env.SMTP_PORT) || 1025,
        secure: process.env.SMTP_SECURE === 'true',
        ignoreTLS: process.env.SMTP_IGNORE_TLS !== 'false',
        auth: process.env.SMTP_USER ? {
          user: process.env.SMTP_USER,
          pass: process.env.SMTP_PASS,
        } : undefined,
      });
      this.logger.log(`Nodemailer initialized for ${process.env.SMTP_HOST || 'local MailDev'}`);
    }
  }

  private readonly emailSubjects: Record<string, string> = {
    'order.placed': 'New order received',
    'delivery.assigned': 'Your rider is on the way',
    'payment.confirmed': 'Payment confirmed',
    'order.preparing': 'Your order is being prepared',
    'order.ready': 'Your order is ready for pickup',
    'order.delivered': 'Your order has been delivered',
    'refund.processed': 'Refund credited to your wallet',
    'dispute.manual_review': 'Dispute under review',
    'quote.sent': 'You have received a quote',
    'quote.accepted': 'Quote accepted — payment confirmed',
    'rider.found': 'Rider assigned to your delivery',
    'handover.completed': 'Goods handed over to rider',
  };

  private getTemplate(type: string, lang: 'rw' | 'en', params: any): string {
    const templates: Record<string, { en: string; rw: string }> = {
      'order.placed': {
        en: `New order ${params.orderNumber} placed. Please prepare.`,
        rw: `Hari komande nshya ${params.orderNumber}. Tegura vuba.`
      },
      'delivery.assigned': {
        en: `Rider ${params.riderName} is assigned to your order.`,
        rw: `Umumotari ${params.riderName} yahawe komande yawe.`
      },
      'payment.confirmed': {
        en: `Payment of ${params.amount} RWF confirmed.`,
        rw: `Uwishyuye ${params.amount} RWF byemejwe.`
      },
      'order.preparing': {
        en: `Your order ${params.orderNumber} is now being prepared.`,
        rw: `Komande yawe ${params.orderNumber} irimo gutegurwa.`
      },
      'order.ready': {
        en: `Your order ${params.orderNumber} is ready for pickup!`,
        rw: `Komande yawe ${params.orderNumber} yabonetse!`
      },
      'order.delivered': {
        en: `Your order ${params.orderNumber} has been delivered. Enjoy!`,
        rw: `Komande yawe ${params.orderNumber} yageze. Mwizihirwe!`
      },
      'refund.processed': {
        en: `Refund of ${params.amount} RWF for order ${params.orderId} has been credited to your wallet.`,
        rw: `Amafaranga ${params.amount} RWF ya komande ${params.orderId} yasubijwe muri wallet yawe.`
      },
      'dispute.manual_review': {
        en: `Order ${params.orderId} requires manual dispute review for ${params.amount} RWF.`,
        rw: `Komande ${params.orderId} ikeneye gusuzumwa n'umuyobozi ku kibazo cya ${params.amount} RWF.`
      },
      'quote.sent': {
        en: `You have received a quote of ${params.amount || '...'} RWF for your order ${params.orderNumber}.`,
        rw: `Wahawe igiciro cy'amafaranga ${params.amount || '...'} RWF ku komande yawe ${params.orderNumber}.`
      },
      'quote.accepted': {
        en: `Your quote for order ${params.orderNumber} has been accepted. Payment is now confirmed.`,
        rw: `Igiciro cyawe ku komande ${params.orderNumber} cyemewe. Kwishyura byemejwe.`
      },
      'rider.found': {
        en: `A rider has been assigned to order ${params.orderNumber} and is heading to pick up your goods.`,
        rw: `Umumotari wahawe komande ${params.orderNumber} kandi aragenda gutwara ibintu byawe.`
      },
      'handover.completed': {
        en: `Goods for order ${params.orderNumber} have been handed over to the rider.`,
        rw: `Ibintu bya komande ${params.orderNumber} bihawe umumotari.`
      },
    };

    return templates[type]?.[lang] || `${this.emailSubjects[type] || type}: ${JSON.stringify(params).slice(0, 80)}`;
  }

  private async getUserContext(userId: string): Promise<any | null> {
    if (!userId) return null;
    return this.userModel.findById(userId).select('email phone preferences').lean().exec();
  }

  private preferencesFor(user: any) {
    return {
      ...this.defaultNotificationPreferences,
      ...(user?.preferences?.notifications || {}),
    };
  }

  private isSecurityType(type: string): boolean {
    return /security|login|password|fraud|risk/i.test(type);
  }

  private isPromotionType(type: string): boolean {
    return /promotion|promo|deal|campaign|flash/i.test(type);
  }

  private isOrderType(type: string): boolean {
    return /order|payment|delivery|refund|dispute|quote|pickup|handover/i.test(type);
  }

  private isCustomMessageType(type: string): boolean {
    return /message|chat|custom/i.test(type);
  }

  private shouldSend(type: string, channel: 'IN_APP' | 'EMAIL' | 'SMS', preferences: ReturnType<NotificationService['preferencesFor']>): { allowed: boolean; reason?: string } {
    if (this.isSecurityType(type) && !preferences.securityAlerts) {
      return { allowed: false, reason: 'security alerts are disabled' };
    }

    if (this.isPromotionType(type) && !preferences.promotions) {
      return { allowed: false, reason: 'promotional notifications are disabled' };
    }

    if (this.isOrderType(type) && !preferences.orderUpdates) {
      return { allowed: false, reason: 'order updates are disabled' };
    }

    if (this.isCustomMessageType(type) && preferences.customMessagesEmailOnly && channel !== 'EMAIL') {
      return { allowed: false, reason: 'custom messages are email-only' };
    }

    if (channel === 'IN_APP' && !preferences.inApp) {
      return { allowed: false, reason: 'in-app notifications are disabled' };
    }

    if (channel === 'EMAIL' && !preferences.email && !(this.isCustomMessageType(type) && preferences.customMessagesEmailOnly)) {
      return { allowed: false, reason: 'email notifications are disabled' };
    }

    if (channel === 'SMS' && !preferences.sms) {
      return { allowed: false, reason: 'SMS notifications are disabled' };
    }

    return { allowed: true };
  }

  private skipped(channel: 'IN_APP' | 'EMAIL' | 'SMS', userId: string, type: string, reason: string) {
    this.logger.log(`[${channel}] Skipped ${type} for ${userId}: ${reason}`);
    return { skipped: true, channel, type, reason };
  }

  async sendSms(userId: string, phone: string, type: string, params: any, lang: 'rw' | 'en' = 'rw'): Promise<any> {
    const user = await this.getUserContext(userId);
    const preferenceCheck = this.shouldSend(type, 'SMS', this.preferencesFor(user));
    if (!preferenceCheck.allowed) {
      return this.skipped('SMS', userId, type, preferenceCheck.reason || 'disabled');
    }

    const content = this.getTemplate(type, lang, params);

    const logEntry = new this.logModel({
      userId,
      channel: 'SMS',
      type,
      referenceId: params.orderId,
      referenceType: 'Order',
      content,
      status: 'PENDING',
      sentAt: new Date()
    });
    const savedLog = await logEntry.save();

    try {
      if (process.env.SMS_WEBHOOK_URL) {
        const response = await fetch(process.env.SMS_WEBHOOK_URL, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...(process.env.SMS_API_KEY ? { Authorization: `Bearer ${process.env.SMS_API_KEY}` } : {}),
          },
          body: JSON.stringify({ userId, phone, type, content, params, lang }),
        });

        if (!response.ok) {
          throw new Error(`SMS provider returned ${response.status}`);
        }
      } else if (process.env.NODE_ENV !== 'production') {
        this.logger.log(`[SMS dev log to ${phone}]: ${content}`);
      } else {
        throw new Error('SMS provider is not configured');
      }

      return await this.logModel.findByIdAndUpdate(
        savedLog._id,
        { status: 'DELIVERED', deliveredAt: new Date() },
        { new: true }
      );
    } catch (error: any) {
      this.logger.error(`Failed to send SMS to ${phone}`, error);
      return await this.logModel.findByIdAndUpdate(
        savedLog._id,
        { status: 'FAILED', failureReason: error.message },
        { new: true }
      );
    }
  }

  async sendEmail(userId: string, email: string, type: string, params: any, lang: 'rw' | 'en' = 'en'): Promise<any> {
    let targetEmail = email;
    const user = await this.getUserContext(userId);
    const preferenceCheck = this.shouldSend(type, 'EMAIL', this.preferencesFor(user));
    if (!preferenceCheck.allowed) {
      return this.skipped('EMAIL', userId, type, preferenceCheck.reason || 'disabled');
    }

    if (!targetEmail && userId) {
      targetEmail = user?.email;
    }

    if (!targetEmail) {
      this.logger.warn(`No email address found for user ${userId}. Skipping email notification.`);
      // M7 fix: save a FAILED log so the caller and admin can see why this notification didn't arrive
      await new this.logModel({
        userId,
        channel: 'EMAIL',
        type,
        referenceId: params.orderId,
        referenceType: 'Order',
        content: `[skipped — no email address on record]`,
        status: 'FAILED',
        failureReason: 'No email address found for user',
        sentAt: new Date()
      }).save().catch(() => { });
      return;
    }

    const content = this.getTemplate(type, lang, params);

    const logEntry = new this.logModel({
      userId,
      channel: 'EMAIL',
      type,
      referenceId: params.orderId,
      referenceType: 'Order',
      content,
      status: 'PENDING',
      sentAt: new Date()
    });
    const savedLog = await logEntry.save();

    try {
      if (this.transporter) {
        // C4 fix: use human-readable subject, never expose internal event type strings
        const subject = this.emailSubjects[type] || 'Rwanda Marketplace notification';
        await this.transporter.sendMail({
          from: '"Rwanda Marketplace" <noreply@rwshop.org>',
          to: targetEmail,
          subject,
          text: content,
          html: `<div style="font-family: sans-serif; padding: 20px; border: 1px solid #eee; border-radius: 10px;">
                  <h2 style="color: #1b4332;">Rwanda Marketplace</h2>
                  <p style="font-size: 16px; color: #333;">${content}</p>
                  <hr style="border: none; border-top: 1px solid #eee; margin: 20px 0;">
                  <p style="font-size: 12px; color: #999;">This is an automated notification from your marketplace dashboard.</p>
                </div>`
        });
        this.logger.log(`[Email sent to ${targetEmail}]: ${content}`);
      } else {
        throw new Error('SMTP transport is not configured');
      }

      return await this.logModel.findByIdAndUpdate(
        savedLog._id,
        { status: 'DELIVERED', deliveredAt: new Date() },
        { new: true }
      );
    } catch (error: any) {
      this.logger.error(`Failed to send Email to ${email}`, error);
      return await this.logModel.findByIdAndUpdate(
        savedLog._id,
        { status: 'FAILED', failureReason: error.message },
        { new: true }
      );
    }
  }

  async getLogs(userId: string): Promise<any> {
    return this.logModel.find({ userId }).sort({ createdAt: -1 }).limit(50).exec();
  }

  async sendInApp(userId: string, type: string, params: any, lang: 'rw' | 'en' = 'en'): Promise<any> {
    const user = await this.getUserContext(userId);
    const preferenceCheck = this.shouldSend(type, 'IN_APP', this.preferencesFor(user));
    if (!preferenceCheck.allowed) {
      return this.skipped('IN_APP', userId, type, preferenceCheck.reason || 'disabled');
    }

    const content = this.getTemplate(type, lang, params);

    const logEntry = new this.logModel({
      userId,
      channel: 'IN_APP',
      type,
      referenceId: params.orderId || params.referenceId,
      referenceType: params.referenceType || 'Order',
      content,
      status: 'DELIVERED',
      sentAt: new Date(),
      deliveredAt: new Date(),
      isRead: false
    });
    const savedLog = await logEntry.save();

    if (this.gateway) {
      this.gateway.emitToUser(userId, 'notification:new', savedLog);
    }

    return savedLog;
  }

  async markAsRead(notificationId: string, userId: string): Promise<any> {
    return this.logModel.findOneAndUpdate(
      { _id: notificationId, userId },
      { isRead: true, readAt: new Date() },
      { new: true }
    );
  }

  async markAllAsRead(userId: string): Promise<any> {
    return this.logModel.updateMany(
      { userId, isRead: false, channel: 'IN_APP' },
      { isRead: true, readAt: new Date() }
    );
  }

  async getUnreadCount(userId: string): Promise<number> {
    return this.logModel.countDocuments({ userId, isRead: false, channel: 'IN_APP' });
  }
}
