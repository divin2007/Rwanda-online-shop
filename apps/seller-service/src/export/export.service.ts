import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';

/**
 * Export Facilitation (Feature 9). Surfaces export-ready Made-in-Rwanda products,
 * lets buyers submit inquiries, and lets sellers manage export settings + inquiries.
 *
 * SECURITY: seller contact details are only revealed to verified export buyers
 * (User.isExportBuyer) — enforced here at the service layer, never in the schema.
 */
@Injectable()
export class ExportService {
  constructor(
    @InjectModel('ExportInquiry') private inquiryModel: Model<any>,
    @InjectModel('Product') private productModel: Model<any>,
    @InjectModel('SellerProfile') private sellerModel: Model<any>,
    @InjectModel('User') private userModel: Model<any>,
  ) {}

  /** Public export catalogue: Made-in-Rwanda products from export-ready sellers. */
  async listExportProducts(filter: { categoryId?: string; marketId?: string; minQty?: number }): Promise<any[]> {
    const exportSellers = await this.sellerModel
      .find({ exportReady: true, isApproved: true, deletedAt: null })
      .select('_id certificationTier exportMinimumOrderQty stallName shopDetails marketId')
      .lean()
      .exec();
    if (!exportSellers.length) return [];

    const sellerById = new Map<string, any>(exportSellers.map((s: any) => [String(s._id), s]));
    const productQuery: any = {
      sellerId: { $in: exportSellers.map((s: any) => s._id) },
      isMadeInRwanda: true,
      isActive: true,
      isApproved: true,
      deletedAt: null,
    };
    if (filter.categoryId) productQuery.categoryId = filter.categoryId;
    if (filter.marketId && Types.ObjectId.isValid(filter.marketId)) {
      productQuery.marketId = new Types.ObjectId(filter.marketId);
    }
    if (filter.minQty && Number(filter.minQty) > 0) {
      productQuery.exportMinQty = { $lte: Number(filter.minQty) };
    }

    const products = await this.productModel
      .find(productQuery)
      .select('name price unit images categoryId categoryLabel sellerId marketId perishable maxDeliveryMinutes exportMinQty isMadeInRwanda')
      .lean()
      .exec();

    return products.map((p: any) => {
      const seller = sellerById.get(String(p.sellerId));
      return {
        ...p,
        seller: seller
          ? {
              _id: seller._id,
              certificationTier: seller.certificationTier || 'BRONZE',
              exportMinimumOrderQty: seller.exportMinimumOrderQty || null,
              stallName: seller.stallName || seller.shopDetails?.name || 'Verified seller',
            }
          : null,
      };
    });
  }

  async createInquiry(buyerUserId: string, body: any): Promise<any> {
    if (!buyerUserId) throw new BadRequestException('Authentication required');
    if (!body?.sellerId || !Types.ObjectId.isValid(body.sellerId)) {
      throw new BadRequestException('A valid sellerId is required');
    }
    const seller = await this.sellerModel.findOne({ _id: body.sellerId, deletedAt: null }).select('_id userId').lean().exec();
    if (!seller) throw new NotFoundException('Seller not found');

    const inquiry = await this.inquiryModel.create({
      exportBuyerUserId: buyerUserId,
      sellerId: seller._id,
      products: Array.isArray(body.products)
        ? body.products.map((p: any) => ({
            productId: Types.ObjectId.isValid(p.productId) ? p.productId : undefined,
            quantity: Number(p.quantity) || undefined,
            unit: p.unit,
          }))
        : [],
      documentsRequested: Array.isArray(body.documentsRequested)
        ? body.documentsRequested
            .filter((d: string) => ['CERTIFICATE_OF_ORIGIN', 'PACKING_LIST', 'PHYTOSANITARY', 'INVOICE'].includes(d))
            .map((d: string) => ({ type: d, status: 'pending' }))
        : [],
      totalEstimatedValue: Number(body.totalEstimatedValue) || undefined,
      deliveryCountry: body.deliveryCountry,
      notes: body.notes,
      status: 'pending',
    });

    this.notify(String(seller.userId), 'export.new_inquiry', { inquiryId: String(inquiry._id) }).catch(() => {});
    return inquiry;
  }

  async myInquiries(buyerUserId: string): Promise<any[]> {
    return this.inquiryModel.find({ exportBuyerUserId: buyerUserId }).sort({ createdAt: -1 }).lean().exec();
  }

  async sellerInquiries(userId: string): Promise<any[]> {
    const seller = await this.sellerModel.findOne({ userId, deletedAt: null }).select('_id').lean().exec();
    if (!seller) throw new NotFoundException('Seller profile not found');
    return this.inquiryModel.find({ sellerId: seller._id }).sort({ createdAt: -1 }).lean().exec();
  }

  async updateExportSettings(userId: string, body: { exportReady?: boolean; exportMinimumOrderQty?: number }): Promise<any> {
    const update: any = {};
    if (typeof body.exportReady === 'boolean') update.exportReady = body.exportReady;
    if (body.exportMinimumOrderQty !== undefined) {
      const qty = Number(body.exportMinimumOrderQty);
      update.exportMinimumOrderQty = Number.isFinite(qty) && qty > 0 ? Math.round(qty) : null;
    }
    if (!Object.keys(update).length) throw new BadRequestException('No export settings provided');

    const seller = await this.sellerModel.findOneAndUpdate(
      { userId, deletedAt: null },
      { $set: update },
      { new: true },
    ).select('exportReady exportMinimumOrderQty').lean().exec();
    if (!seller) throw new NotFoundException('Seller profile not found');
    return seller;
  }

  private async notify(userId: string, type: string, params: any): Promise<void> {
    try {
      const axios = require('axios');
      const url = `${process.env.NOTIFICATION_SERVICE_URL || 'http://localhost:3009/api/v1'}/notifications/dispatch`;
      const secret = process.env.INTERNAL_SERVICE_SECRET;
      const headers = secret ? { 'x-internal-service-key': secret } : {};
      await axios.post(url, { userId, type, params, channels: ['IN_APP', 'EMAIL'] }, { headers });
    } catch {
      /* non-blocking */
    }
  }
}
