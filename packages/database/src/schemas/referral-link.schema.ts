import mongoose, { Schema, model } from 'mongoose';

// A shareable referral link for a specific product, owned by an approved affiliate.
// commissionRate is capped server-side at AFFILIATE_MAX_COMMISSION_RATE (default 15%).
export const referralLinkSchema = new Schema({
  affiliateUserId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  productId: { type: Schema.Types.ObjectId, ref: 'Product', required: true },
  sellerId: { type: Schema.Types.ObjectId, ref: 'SellerProfile', required: true },
  slug: { type: String, required: true, unique: true },
  commissionRate: { type: Number, default: 5 },
  commissionType: { type: String, enum: ['percent', 'fixed'], default: 'percent' },
  clickCount: { type: Number, default: 0 },
  conversionCount: { type: Number, default: 0 },
  totalEarned: { type: Number, default: 0 },
  status: { type: String, enum: ['active', 'paused', 'revoked'], default: 'active' },
  approvedAt: { type: Date },
  deletedAt: { type: Date, default: null }
}, { timestamps: true });

// slug uniqueness already creates an index via unique:true above.
referralLinkSchema.index({ affiliateUserId: 1, sellerId: 1 });
referralLinkSchema.index({ productId: 1, status: 1 });

export const ReferralLink = mongoose.models.ReferralLink || model('ReferralLink', referralLinkSchema);
