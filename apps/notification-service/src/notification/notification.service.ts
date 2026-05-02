import { Injectable, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';

@Injectable()
export class NotificationService {
  private readonly logger = new Logger(NotificationService.name);

  constructor(
    @InjectModel('NotificationLog') private logModel: Model<any>
  ) {}

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
      }
    };
    
    return templates[type]?.[lang] || `Notification: ${type}`;
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
      // Stub: SendGrid API integration would go here
      this.logger.log(`[Email to ${email}]: ${content}`);
      
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
}
