import { Schema, model } from 'mongoose';

export const riderRejectionSchema = new Schema({
  riderId: { type: Schema.Types.ObjectId, ref: 'RiderProfile', required: true },
  orderId: { type: Schema.Types.ObjectId, ref: 'Transaction', required: true },
  reason: { type: String },
  timestamp: { type: Date, default: Date.now }
}, { timestamps: { createdAt: true, updatedAt: false } });

export const RiderRejection = model('RiderRejection', riderRejectionSchema);
