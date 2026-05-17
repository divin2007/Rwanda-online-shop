import mongoose, { Schema, model } from 'mongoose';

export const sellerProfileSchema = new Schema({
  userId: { type: Schema.Types.ObjectId, ref: 'User', required: true, unique: true },
  marketId: { type: Schema.Types.ObjectId, ref: 'Market', required: true },
  stallId: { type: String, required: true, unique: true }, // Format: MARKETCODE-XXX
  stallName: { type: String, required: true },
  description: { type: String },
  shopDetails: {
    name: { type: String },
    slug: { type: String },
    code: { type: String },
    logoUrl: { type: String },
    bannerUrl: { type: String },
    imageUrl: { type: String }, // Added to support onboarding imagery
    hubImageUrl: { type: String },
    tagline: { type: String },
    description: { type: String },
    daysOpen: [{ type: String }],
    operatingHours: {
      open: { type: String },
      close: { type: String },
      daysOpen: [{ type: String }]
    },
    categories: [{ type: String }],
  },
  isApproved: { type: Boolean, default: false },
  isOnVacation: { type: Boolean, default: false },
  vacationMessage: { type: String, default: 'This shop is temporarily closed. We\'ll be back soon!' },
  rating: { type: Number, default: 0 },
  totalSales: { type: Number, default: 0 },
  totalOrders: { type: Number, default: 0 },
  businessPermitUrl: { type: String },
  rraCertificateUrl: { type: String },
  idCardUrl: { type: String },
  stallPhotoUrl: { type: String },
  capabilities: {
    delivery: { type: Boolean, default: true },
    bulk: { type: Boolean, default: false },
    custom: { type: Boolean, default: false },
    returns: { type: Boolean, default: true },
  },
  contractVersion: { type: String },
  agreedToTermsAt: { type: Date },
  deletedAt: { type: Date, default: null }
}, { timestamps: true });

export const SellerProfile = mongoose.models.SellerProfile || model('SellerProfile', sellerProfileSchema);
