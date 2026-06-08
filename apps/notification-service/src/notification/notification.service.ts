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
    const smtpHost = process.env.SMTP_HOST || (isDev ? 'localhost' : '');
    const smtpPort = Number(process.env.SMTP_PORT) || (isDev ? 1025 : 587);
    const hasRealSmtp = Boolean(smtpHost && smtpHost !== 'localhost' && process.env.SMTP_USER);

    if (isDev || smtpHost) {
      // For production SMTP (e.g. AWS SES on port 587): use STARTTLS, NOT raw TLS.
      // secure=false + requireTLS=true ensures STARTTLS handshake on port 587.
      // ignoreTLS must be false for real SMTP providers; only true for local MailDev.
      const useStartTls = hasRealSmtp && smtpPort === 587;
      const secure = process.env.SMTP_SECURE === 'true' || (hasRealSmtp && smtpPort === 465);
      const ignoreTLS = hasRealSmtp ? false : (process.env.SMTP_IGNORE_TLS !== 'false');

      this.transporter = nodemailer.createTransport({
        host: smtpHost,
        port: smtpPort,
        secure,
        ignoreTLS,
        requireTLS: useStartTls,
        auth: process.env.SMTP_USER ? {
          user: process.env.SMTP_USER,
          pass: process.env.SMTP_PASS,
        } : undefined,
      });
      this.logger.log(`Nodemailer initialized for ${smtpHost}:${smtpPort} (secure=${secure}, requireTLS=${useStartTls}, ignoreTLS=${ignoreTLS})`);
    } else {
      this.logger.warn('SMTP is not configured. Email notifications will not be sent.');
    }
  }

  private readonly emailSubjects: Record<string, string> = {
    'order.placed': 'New order received',
    'delivery.assigned': 'Your rider is on the way',
    'payment.confirmed': 'Payment confirmed',
    'order.preparing': 'Your order is being prepared',
    'order.ready': 'Your order is ready for pickup',
    'order.delivered': 'Your order has been delivered',
    'refund.processed': 'Refund sent to your mobile money number',
    'dispute.manual_review': 'Dispute under review',
    'quote.sent': 'You have received a quote',
    'quote.accepted': 'Quote accepted — payment confirmed',
    'rider.found': 'Rider assigned to your delivery',
    'handover.completed': 'Goods handed over to rider',
    'order.message.sent': 'Message sent',
    'order.message.received': 'New message received',
    'support.message.sent': 'Support message sent',
    'admin.support_ticket_created': 'New Support Ticket Received',
    'seller.status_update': 'Merchant Account Update',
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
        en: `Refund of ${params.amount} RWF for order ${params.orderId} has been sent through Paypack to your mobile money number.`,
        rw: `Amafaranga ${params.amount} RWF ya komande ${params.orderId} yoherejwe kuri Mobile Money yawe biciye muri Paypack.`
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
      'order.message.sent': {
        en: `Your ${String(params.channel || 'order').toLowerCase()} message on order ${params.orderNumber || params.orderId} was sent: ${params.preview || 'Message sent'}`,
        rw: `Ubutumwa bwawe kuri komande ${params.orderNumber || params.orderId} bwoherejwe: ${params.preview || 'Ubutumwa bwoherejwe'}`
      },
      'order.message.received': {
        en: `New ${String(params.channel || 'order').toLowerCase()} message from ${String(params.senderRole || 'participant').toLowerCase()} on order ${params.orderNumber || params.orderId}: ${params.preview || 'Open the order to reply'}`,
        rw: `Hari ubutumwa bushya kuri komande ${params.orderNumber || params.orderId}: ${params.preview || 'Fungura komande usubize'}`
      },
      'support.message.sent': {
        en: `Your support message "${params.subject || 'Support request'}" was sent to the admin team.`,
        rw: `Ubutumwa bwawe bwo gusaba ubufasha "${params.subject || 'Ubusabe'}" bwoherejwe ku buyobozi.`
      },
      'admin.support_ticket_created': {
        en: `New support ticket received from ${params.name} (${params.userEmail}).\n\nSubject: ${params.subject}\n\nMessage:\n${params.message}`,
        rw: `Hari ubutumwa bushya bwo gusaba ubufasha buturutse kuri ${params.name} (${params.userEmail}).\n\nImpamvu: ${params.subject}\n\nUbutumwa:\n${params.message}`
      },
      'seller.status_update': {
        en: `${params.message || 'Your merchant status has been updated.'}`,
        rw: `${params.message || 'Uburenganzira bwawe bwo kugurisha bwavuguruwe.'}`
      },
      'admin.notification': {
        en: `${params.message || 'New admin action required.'}`,
        rw: `${params.message || 'Gukora igikorwa gishya cy\'ubuyobozi.'}`
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
    return /message|chat|custom|support/i.test(type);
  }

  private shouldSend(type: string, channel: 'IN_APP' | 'EMAIL' | 'SMS' | 'WHATSAPP', preferences: ReturnType<NotificationService['preferencesFor']>): { allowed: boolean; reason?: string } {
    if (this.isSecurityType(type) && !preferences.securityAlerts) {
      return { allowed: false, reason: 'security alerts are disabled' };
    }

    if (this.isPromotionType(type) && !preferences.promotions) {
      return { allowed: false, reason: 'promotional notifications are disabled' };
    }

    if (this.isOrderType(type) && !preferences.orderUpdates) {
      return { allowed: false, reason: 'order updates are disabled' };
    }

    if (this.isCustomMessageType(type) && !type.startsWith('order.message.') && preferences.customMessagesEmailOnly && channel !== 'EMAIL') {
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

    if (channel === 'WHATSAPP' && !preferences.whatsapp) {
      return { allowed: false, reason: 'WhatsApp notifications are disabled' };
    }

    return { allowed: true };
  }

  private skipped(channel: 'IN_APP' | 'EMAIL' | 'SMS' | 'WHATSAPP', userId: string, type: string, reason: string) {
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
        { returnDocument: 'after' }
      );
    } catch (error: any) {
      this.logger.error(`Failed to send SMS to ${phone}`, error);
      return await this.logModel.findByIdAndUpdate(
        savedLog._id,
        { status: 'FAILED', failureReason: error.message },
        { returnDocument: 'after' }
      );
    }
  }

  async sendWhatsApp(userId: string, phone: string, type: string, params: any, lang: 'rw' | 'en' = 'rw'): Promise<any> {
    let targetPhone = phone;
    const user = await this.getUserContext(userId);
    const preferenceCheck = this.shouldSend(type, 'WHATSAPP', this.preferencesFor(user));
    if (!preferenceCheck.allowed) {
      return this.skipped('WHATSAPP', userId, type, preferenceCheck.reason || 'disabled');
    }

    if (!targetPhone && userId) {
      targetPhone = user?.phone;
    }

    const content = this.getTemplate(type, lang, params);
    const logEntry = new this.logModel({
      userId,
      channel: 'WHATSAPP',
      type,
      referenceId: params.orderId || params.referenceId,
      referenceType: params.referenceType || 'Order',
      content,
      status: 'PENDING',
      sentAt: new Date()
    });
    const savedLog = await logEntry.save();

    try {
      if (!targetPhone) {
        throw new Error('No phone number found for WhatsApp notification');
      }
      if (process.env.WHATSAPP_WEBHOOK_URL) {
        const response = await fetch(process.env.WHATSAPP_WEBHOOK_URL, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...(process.env.WHATSAPP_API_KEY ? { Authorization: `Bearer ${process.env.WHATSAPP_API_KEY}` } : {}),
          },
          body: JSON.stringify({ userId, phone: targetPhone, type, content, params, lang }),
        });
        if (!response.ok) {
          throw new Error(`WhatsApp provider returned ${response.status}`);
        }
      } else if (process.env.NODE_ENV !== 'production') {
        this.logger.log(`[WhatsApp dev log to ${targetPhone}]: ${content}`);
      } else {
        throw new Error('WhatsApp provider is not configured');
      }

      return await this.logModel.findByIdAndUpdate(
        savedLog._id,
        { status: 'DELIVERED', deliveredAt: new Date() },
        { returnDocument: 'after' }
      );
    } catch (error: any) {
      this.logger.error(`Failed to send WhatsApp to ${targetPhone || userId}`, error);
      return await this.logModel.findByIdAndUpdate(
        savedLog._id,
        { status: 'FAILED', failureReason: error.message },
        { returnDocument: 'after' }
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
        const fromAddress = process.env.SMTP_FROM || '"Rwanda Marketplace" <noreply@rwshop.org>';
        await this.transporter.sendMail({
          from: fromAddress,
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
        { returnDocument: 'after' }
      );
    } catch (error: any) {
      this.logger.error(`Failed to send Email to ${targetEmail}`, error);
      return await this.logModel.findByIdAndUpdate(
        savedLog._id,
        { status: 'FAILED', failureReason: error.message },
        { returnDocument: 'after' }
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

  async dispatch(userId: string, type: string, params: any, channels: Array<'IN_APP' | 'EMAIL' | 'SMS' | 'WHATSAPP'> = ['IN_APP'], lang: 'rw' | 'en' = 'en'): Promise<any[]> {
    const uniqueChannels = Array.from(new Set(channels.length ? channels : ['IN_APP']));
    const user = await this.getUserContext(userId);
    const tasks = uniqueChannels.map(channel => {
      if (channel === 'EMAIL') return this.sendEmail(userId, user?.email || '', type, params, lang);
      if (channel === 'SMS') return this.sendSms(userId, user?.phone || '', type, params, lang);
      if (channel === 'WHATSAPP') return this.sendWhatsApp(userId, user?.phone || '', type, params, lang);
      return this.sendInApp(userId, type, params, lang);
    });
    return Promise.all(tasks);
  }

  async notifyAdmins(type: string, params: any): Promise<void> {
    try {
      const admins = await this.userModel.find({ role: 'ADMIN' }).select('_id').lean().exec();
      this.logger.log(`Notifying ${admins.length} administrators for action: ${type}`);
      for (const admin of admins) {
        await this.sendInApp(admin._id.toString(), type, params);
      }
    } catch (err) {
      this.logger.error('Failed to send admin notifications', err);
    }
  }

  async markAsRead(notificationId: string, userId: string): Promise<any> {
    return this.logModel.findOneAndUpdate(
      { _id: notificationId, userId },
      { isRead: true, readAt: new Date() },
      { returnDocument: 'after' }
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
