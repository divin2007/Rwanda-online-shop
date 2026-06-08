import mongoose, { Schema, model } from 'mongoose';

// Rider errand: a buyer hires a rider for an ad-hoc pickup/drop task (not a marketplace order).
// On completion the rider wallet is credited (referenceType='errand', referenceId=errandId).
export const errandSchema = new Schema({
  buyerId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  description: { type: String, required: true, maxlength: 1000 },
  pickupLocation: {
    address: { type: String, required: true },
    coordinates: {
      lat: { type: Number, required: true },
      lng: { type: Number, required: true }
    }
  },
  dropLocation: {
    address: { type: String, required: true },
    coordinates: {
      lat: { type: Number, required: true },
      lng: { type: Number, required: true }
    }
  },
  budget: { type: Number, required: true },
  agreedFee: { type: Number },
  // Platform's 10% cut and the rider's 90% share of agreedFee (Phase 3 person-pickup).
  riderEarnings: { type: Number },
  tipAmount: { type: Number, default: 0 },
  // errandType: 'person_pickup' is premium-rider-only and may be paid externally (cash to rider).
  errandType: { type: String, enum: ['goods_pickup', 'person_pickup'], default: 'goods_pickup' },
  // paymentMethod: 'platform' = MoMo collection + wallet credit; 'external' = rider paid directly.
  paymentMethod: { type: String, enum: ['platform', 'external'], default: 'platform' },
  payment: {
    status: { type: String, enum: ['pending', 'paid', 'failed', 'external'], default: 'pending' },
    transactionRef: { type: String },
    paidAt: { type: Date },
  },
  status: { type: String, enum: ['open', 'accepted', 'in_progress', 'completed', 'cancelled'], default: 'open' },
  riderId: { type: Schema.Types.ObjectId, ref: 'RiderProfile' },
  riderUserId: { type: Schema.Types.ObjectId, ref: 'User' },
  tracking: [{
    lat: { type: Number },
    lng: { type: Number },
    recordedAt: { type: Date }
  }],
  dispatch: {
    notifiedRiderIds: [{ type: Schema.Types.ObjectId, ref: 'User' }],
    lastBroadcastAt: { type: Date },
    currentRadiusMeters: { type: Number }
  },
  completedAt: { type: Date },
  cancelledAt: { type: Date },
  cancelReason: { type: String },
  deletedAt: { type: Date, default: null }
}, { timestamps: true });

errandSchema.index({ buyerId: 1, status: 1 });
errandSchema.index({ status: 1, createdAt: -1 });
errandSchema.index({ 'pickupLocation.coordinates': '2dsphere' });

export const Errand = mongoose.models.Errand || model('Errand', errandSchema);
