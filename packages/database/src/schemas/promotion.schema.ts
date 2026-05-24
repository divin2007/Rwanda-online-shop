import { Schema, model } from 'mongoose';
import { PromotionType } from '@rmf/shared-types';

export const promotionSchema = new Schema({
  sellerId: { type: Schema.Types.ObjectId, ref: 'SellerProfile', required: true },
  productId: { type: Schema.Types.ObjectId, ref: 'Product', required: true },
  variantSku: { type: String, default: null },
  type: { type: String, enum: Object.values(PromotionType), required: true },
  discount: { type: Number, required: true },
  startDate: { type: Date, required: true },
  endDate: { type: Date, required: true },
  maxQuantity: { type: Number },
  currentSales: { type: Number, default: 0 },
  promotedPrice: { type: Number },
  isActive: { type: Boolean, default: true },
  deletedAt: { type: Date, default: null }
}, { timestamps: true });

export const Promotion = model('Promotion', promotionSchema);
