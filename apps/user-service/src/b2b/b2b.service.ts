import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';

/**
 * B2B account management (Feature 7, user side). One account per user.
 */
@Injectable()
export class B2bService {
  constructor(@InjectModel('B2BAccount') private b2bModel: Model<any>) {}

  async create(userId: string, body: any): Promise<any> {
    const existing = await this.b2bModel.findOne({ userId, deletedAt: null }).lean().exec();
    if (existing) throw new BadRequestException('You already have a B2B account');

    if (!body?.organizationName) throw new BadRequestException('organizationName is required');
    const validTypes = ['HOTEL', 'RESTAURANT', 'CATERER', 'SCHOOL', 'OFFICE', 'NGO'];
    if (!validTypes.includes(body.organizationType)) {
      throw new BadRequestException('A valid organizationType is required');
    }

    return this.b2bModel.create({
      userId,
      organizationName: String(body.organizationName).slice(0, 200),
      organizationType: body.organizationType,
      contactPhone: body.contactPhone,
      taxId: body.taxId,
      verificationDocUrl: body.verificationDocUrl,
      billingMethod: ['MOMO', 'INVOICE'].includes(body.billingMethod) ? body.billingMethod : 'MOMO',
      monthlyInvoiceEnabled: Boolean(body.monthlyInvoiceEnabled),
      isVerified: false,
    });
  }

  async getMine(userId: string): Promise<any> {
    return this.b2bModel.findOne({ userId, deletedAt: null }).lean().exec();
  }
}
