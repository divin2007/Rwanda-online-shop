import mongoose, { Schema, model } from 'mongoose';

export const sellerProfileSchema = new Schema({
  userId: { type: Schema.Types.ObjectId, ref: 'User', required: true, unique: true },
  marketId: { type: Schema.Types.ObjectId, ref: 'Market', required: true },
  businessType: {
    type: String,
    enum: ['STANDARD', 'RESTAURANT', 'HOTEL', 'CAFE', 'BAKERY', 'CATERING', 'JUICE_BAR', 'FOOD_KIOSK'],
    default: 'STANDARD'
  },
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
  // Seller certification tier (computed weekly by admin tier-calculation job).
  certificationTier: { type: String, enum: ['BRONZE', 'SILVER', 'GOLD'], default: 'BRONZE' },
  tierCalculatedAt: { type: Date },
  tierMetrics: {
    disputeRate: { type: Number },
    avgRating: { type: Number },
    totalOrders: { type: Number }
  },
  // Verified freshness check-in (food sellers).
  freshnessCheckin: {
    checkedInAt: { type: Date },
    confirmedByRiderId: { type: Schema.Types.ObjectId, ref: 'RiderProfile' },
    expiresAt: { type: Date }
  },
  // Export facilitation — exportReady is the seller-level eligibility flag (constraint 5).
  exportReady: { type: Boolean, default: false },
  exportMinimumOrderQty: { type: Number },
  // Seller premium advertising. Premium sellers are eligible for labelled
  // spotlight ranking when their products match the user's search.
  isPremium: { type: Boolean, default: false },
  premiumTier: { type: String, enum: ['none', 'basic', 'standard', 'spotlight'], default: 'none' },
  premiumUntil: { type: Date, default: null },
  spotlightScore: { type: Number, default: 0 },
  deletedAt: { type: Date, default: null }
}, { timestamps: true });

sellerProfileSchema.index({ premiumTier: 1, spotlightScore: -1 });

export const SellerProfile = mongoose.models.SellerProfile || model('SellerProfile', sellerProfileSchema);
