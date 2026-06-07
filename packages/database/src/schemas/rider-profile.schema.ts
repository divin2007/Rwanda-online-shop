import mongoose, { Schema, model } from 'mongoose';

export const riderProfileSchema = new Schema({
  userId: { type: Schema.Types.ObjectId, ref: 'User', required: true, unique: true },
  plateNumber: { type: String, required: true, unique: true },
  isApproved: { type: Boolean, default: false },
  isActive: { type: Boolean, default: false },
  currentLocation: {
    lat: Number,
    lng: Number,
    updatedAt: Date
  },
  rating: { type: Number, default: 0 },
  totalDeliveries: { type: Number, default: 0 },
  rejectionRate: { type: Number, default: 0 },
  // Reliability tracking (Phase 2). reliabilityScore is bounded 0.0–1.0.
  reliabilityScore: { type: Number, default: 1, min: 0, max: 1 },
  cancellationCount: { type: Number, default: 0 },
  // Review breakdown used to compute the elevated (93%) rider split.
  fiveStarCount: { type: Number, default: 0 },
  totalReviewCount: { type: Number, default: 0 },
  // Premium plan membership.
  plan: { type: String, enum: ['standard', 'premium'], default: 'standard' },
  premiumUntil: { type: Date, default: null },
  licenseUrl: { type: String },
  vehiclePhotoUrl: { type: String },
  idCardUrl: { type: String },
  insuranceUrl: { type: String },
  deletedAt: { type: Date, default: null }
}, { timestamps: true });

export const RiderProfile = mongoose.models.RiderProfile || model('RiderProfile', riderProfileSchema);
