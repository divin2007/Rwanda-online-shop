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
  licenseUrl: { type: String },
  vehiclePhotoUrl: { type: String },
  idCardUrl: { type: String },
  insuranceUrl: { type: String },
  deletedAt: { type: Date, default: null }
}, { timestamps: true });

export const RiderProfile = mongoose.models.RiderProfile || model('RiderProfile', riderProfileSchema);
