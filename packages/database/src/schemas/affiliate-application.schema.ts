import mongoose, { Schema, model } from 'mongoose';

// An affiliate's request to promote a specific seller's product. Seller approves/rejects.
export const affiliateApplicationSchema = new Schema({
  applicantUserId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  sellerId: { type: Schema.Types.ObjectId, ref: 'SellerProfile', required: true },
  productId: { type: Schema.Types.ObjectId, ref: 'Product', required: true },
  proposedCommissionRate: { type: Number },
  status: { type: String, enum: ['pending', 'approved', 'rejected'], default: 'pending' },
  reviewedAt: { type: Date },
  reviewNote: { type: String }
}, { timestamps: true });

affiliateApplicationSchema.index({ sellerId: 1, status: 1 });
affiliateApplicationSchema.index({ applicantUserId: 1, status: 1 });

export const AffiliateApplication = mongoose.models.AffiliateApplication || model('AffiliateApplication', affiliateApplicationSchema);
