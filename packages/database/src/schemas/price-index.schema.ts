import mongoose, { Schema, model } from 'mongoose';

// Weekly market price index per (week, market, category). Computed by an admin cron from
// DELIVERED transactions and published manually before becoming public.
export const priceIndexSchema = new Schema({
  week: { type: String, required: true }, // ISO week, e.g. "2026-W23"
  marketId: { type: Schema.Types.ObjectId, ref: 'Market', required: true },
  categoryId: { type: String, required: true },
  categoryLabel: { type: String },
  avgPrice: { type: Number },
  minPrice: { type: Number },
  maxPrice: { type: Number },
  sampleSize: { type: Number },
  trend: { type: String, enum: ['RISING', 'STABLE', 'FALLING'] },
  isPublished: { type: Boolean, default: false },
  publishedAt: { type: Date },
  reportPdfUrl: { type: String },
  deletedAt: { type: Date, default: null }
}, { timestamps: true });

priceIndexSchema.index({ week: 1, marketId: 1, categoryId: 1 }, { unique: true });
priceIndexSchema.index({ week: 1, isPublished: 1 });

export const PriceIndex = mongoose.models.PriceIndex || model('PriceIndex', priceIndexSchema);
