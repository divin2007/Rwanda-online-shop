import { Schema, model } from 'mongoose';
import { UserRole } from '@rmf/shared-types';

const recommendationSignalSchema = new Schema({
  key: { type: String, required: true, trim: true },
  score: { type: Number, default: 0 },
  lastSeenAt: { type: Date, default: Date.now },
}, { _id: false });

const recommendationObjectSignalSchema = new Schema({
  refId: { type: Schema.Types.ObjectId, required: true },
  score: { type: Number, default: 0 },
  lastSeenAt: { type: Date, default: Date.now },
}, { _id: false });

export const userSchema = new Schema({
  fullName: { type: String, required: true },
  email: { type: String, required: true, unique: true },
  phone: { type: String, required: true, unique: true },
  passwordHash: { type: String, required: true },
  googleId: { type: String },
  role: { 
    type: String, 
    enum: Object.values(UserRole), 
    required: true,
    default: UserRole.BUYER
  },
  isVerified: { type: Boolean, default: false },
  isActive: { type: Boolean, default: true },
  avatarUrl: { type: String },
  wishlist: [{ type: Schema.Types.ObjectId, ref: 'Product' }],
  referralCode: { type: String, unique: true, sparse: true },
  referredBy: { type: String }, // Stores the code of the user who referred them
  referralEarnings: { type: Number, default: 0 },
  devices: [{ 
    token: String, 
    platform: String, 
    lastUsed: Date 
  }],
  preferences: {
    language: { type: String, enum: ['en', 'fr', 'kin'], default: 'en' },
    currency: { type: String, enum: ['RWF', 'USD', 'EUR'], default: 'RWF' },
    notifications: {
      inApp: { type: Boolean, default: true },
      email: { type: Boolean, default: true },
      sms: { type: Boolean, default: false },
      whatsapp: { type: Boolean, default: false },
      orderUpdates: { type: Boolean, default: true },
      promotions: { type: Boolean, default: false },
      securityAlerts: { type: Boolean, default: true },
      customMessagesEmailOnly: { type: Boolean, default: false }
    },
    privacy: {
      showProfilePhoto: { type: Boolean, default: true },
      sharePhoneWithOrderParties: { type: Boolean, default: true }
    },
    seller: {
      autoReplyEnabled: { type: Boolean, default: false },
      autoReplyMessage: { type: String, default: '' },
      quoteExpiryHours: { type: Number, default: 24 }
    },
    rider: {
      autoAcceptNearby: { type: Boolean, default: false },
      maxPickupDistanceKm: { type: Number, default: 8 }
    },
    discovery: {
      categoryIds: [{ type: String, trim: true, lowercase: true }],
      marketIds: [{ type: Schema.Types.ObjectId, ref: 'Market' }],
      onboardingCompleted: { type: Boolean, default: false },
      updatedAt: Date
    }
  },
  recommendationProfile: {
    categoryScores: [recommendationSignalSchema],
    marketScores: [recommendationObjectSignalSchema],
    sellerScores: [recommendationObjectSignalSchema],
    productScores: [recommendationObjectSignalSchema],
    recentProductIds: [{ type: Schema.Types.ObjectId, ref: 'Product' }],
    lastInteractionAt: Date
  },
  security: {
    lastLoginAt: Date,
    lastLoginIp: String,
    failedLoginAttempts: { type: Number, default: 0 },
    lockedUntil: Date,
    refreshTokenHash: { type: String },
    passwordChangedAt: Date,
    twoFactorEnabled: { type: Boolean, default: false }
  },
  deletedAt: { type: Date, default: null } // Soft delete
}, { timestamps: true });

userSchema.index({ 'preferences.discovery.categoryIds': 1 });
userSchema.index({ 'recommendationProfile.categoryScores.key': 1 });

export const User = model('User', userSchema);
