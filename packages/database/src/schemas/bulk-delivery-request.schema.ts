import mongoose, { Schema, model } from 'mongoose';

// Same-day bulk delivery for a verified B2B account: one pickup, many drop points.
export const bulkDeliveryRequestSchema = new Schema({
  b2bAccountId: { type: Schema.Types.ObjectId, ref: 'B2BAccount', required: true },
  buyerUserId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  marketId: { type: Schema.Types.ObjectId, ref: 'Market', required: true },
  items: [{
    name: { type: String },
    quantity: { type: Number },
    unit: { type: String },
    estimatedWeight: { type: Number }
  }],
  scheduledPickupWindow: {
    start: { type: Date },
    end: { type: Date }
  },
  dropoffPoints: [{
    address: { type: String },
    coordinates: {
      lat: { type: Number },
      lng: { type: Number }
    },
    contactName: { type: String },
    contactPhone: { type: String },
    deliveredAt: { type: Date },
    status: { type: String, enum: ['pending', 'delivered', 'failed'], default: 'pending' }
  }],
  riderId: { type: Schema.Types.ObjectId, ref: 'RiderProfile' },
  riderUserId: { type: Schema.Types.ObjectId, ref: 'User' },
  totalFee: { type: Number },
  perDropFee: { type: Number, default: 500 },
  status: { type: String, enum: ['scheduled', 'assigned', 'in_progress', 'completed', 'cancelled'], default: 'scheduled' },
  notes: { type: String },
  deletedAt: { type: Date, default: null }
}, { timestamps: true });

bulkDeliveryRequestSchema.index({ b2bAccountId: 1, status: 1 });
bulkDeliveryRequestSchema.index({ status: 1, createdAt: -1 });

export const BulkDeliveryRequest = mongoose.models.BulkDeliveryRequest || model('BulkDeliveryRequest', bulkDeliveryRequestSchema);
