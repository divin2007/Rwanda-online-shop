import { Injectable, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import * as nodemailer from 'nodemailer';

@Injectable()
export class NotificationService {
  private readonly logger = new Logger(NotificationService.name);

  constructor(
    @InjectModel('NotificationLog') private logModel: Model<any>
  ) {
    this.initTransporter();
  }

  private gateway: any | null = null;

  setGateway(gateway: any) {
    this.gateway = gateway;
  }

  private transporter: nodemailer.Transporter | null = null;

  private initTransporter() {
    // Only use local SMTP if explicitly configured or in dev
    const isDev = process.env.NODE_ENV !== 'production';
    if (isDev || process.env.SMTP_HOST) {
      this.transporter = nodemailer.createTransport({
        host: process.env.SMTP_HOST || 'localhost',
        port: Number(process.env.SMTP_PORT) || 1025,
        secure: false,
        ignoreTLS: true
      });
      this.logger.log('Nodemailer initialized for local MailDev');
    }
  }

  private getTemplate(type: string, lang: 'rw' | 'en', params: any): string {
    const templates = {
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
      }
    };
    
    return (templates as Record<string, { en: string; rw: string }>)[type]?.[lang] || `Notification: ${type}`;
  }

  async sendSms(userId: string, phone: string, type: string, params: any, lang: 'rw' | 'en' = 'rw'): Promise<any> {
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
      // Stub: Africa's Talking API integration would go here
      this.logger.log(`[SMS to ${phone}]: ${content}`);
      
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
        await this.transporter.sendMail({
          from: '"Rwanda Marketplace" <noreply@rwshop.org>',
          to: email,
          subject: `Market Notification: ${type}`,
          text: content,
          html: `<div style="font-family: sans-serif; padding: 20px; border: 1px solid #eee; border-radius: 10px;">
                  <h2 style="color: #2563eb;">Rwanda Online Shop</h2>
                  <p style="font-size: 16px; color: #333;">${content}</p>
                  <hr style="border: none; border-top: 1px solid #eee; margin: 20px 0;">
                  <p style="font-size: 12px; color: #999;">This is an automated notification from your marketplace dashboard.</p>
                </div>`
        });
        this.logger.log(`[Email sent via MailDev to ${email}]: ${content}`);
      } else {
        // Stub for production (e.g. SendGrid)
        this.logger.log(`[Email Stub to ${email}]: ${content}`);
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
