import mongoose, { Schema, model } from 'mongoose';

export const sellerProfileSchema = new Schema({
  userId: { type: Schema.Types.ObjectId, ref: 'User', required: true, unique: true },
  marketId: { type: Schema.Types.ObjectId, ref: 'Market', required: true },
  stallId: { type: String, required: true, unique: true }, // Format: MARKETCODE-XXX
  stallName: { type: String, required: true },
  description: { type: String },
  shopDetails: {
    name: { type: String },
    logoUrl: { type: String },
    bannerUrl: { type: String },
    imageUrl: { type: String }, // Added to support onboarding imagery
    tagline: { type: String },
  },
  isApproved: { type: Boolean, default: false },
  isOnVacation: { type: Boolean, default: false },
  vacationMessage: { type: String, default: 'This shop is temporarily closed. We\'ll be back soon!' },
  rating: { type: Number, default: 0 },
  totalSales: { type: Number, default: 0 },
  totalOrders: { type: Number, default: 0 },
  businessPermitUrl: { type: String },
  idCardUrl: { type: String },
  stallPhotoUrl: { type: String },
  deletedAt: { type: Date, default: null }
}, { timestamps: true });

export const SellerProfile = mongoose.models.SellerProfile || model('SellerProfile', sellerProfileSchema);
