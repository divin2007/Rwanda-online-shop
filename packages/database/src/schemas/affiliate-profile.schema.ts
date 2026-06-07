import mongoose, { Schema, model } from 'mongoose';

// Market influencer / affiliate profile. One per user.
export const affiliateProfileSchema = new Schema({
  userId: { type: Schema.Types.ObjectId, ref: 'User', required: true, unique: true },
  displayName: { type: String },
  status: { type: String, enum: ['pending', 'approved', 'suspended'], default: 'pending' },
  totalClicks: { type: Number, default: 0 },
  totalConversions: { type: Number, default: 0 },
  totalEarnings: { type: Number, default: 0 },
  approvedAt: { type: Date },
  suspendedAt: { type: Date },
  suspendReason: { type: String },
  deletedAt: { type: Date, default: null }
}, { timestamps: true });

export const AffiliateProfile = mongoose.models.AffiliateProfile || model('AffiliateProfile', affiliateProfileSchema);
