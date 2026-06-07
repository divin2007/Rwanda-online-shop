import mongoose, { Schema, model } from 'mongoose';

// Group buying campaign. Buyers join to unlock a bulk discount once targetQty is reached.
// Participant addresses are stored here but MUST NOT be exposed to other participants.
export const groupBuySchema = new Schema({
  sellerId: { type: Schema.Types.ObjectId, ref: 'SellerProfile', required: true },
  sellerUserId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  productId: { type: Schema.Types.ObjectId, ref: 'Product', required: true },
  marketId: { type: Schema.Types.ObjectId, ref: 'Market', required: true },
  targetQty: { type: Number, required: true, min: 2 },
  currentQty: { type: Number, default: 0 },
  discountPercent: { type: Number, required: true, min: 1, max: 70 },
  deadline: { type: Date, required: true },
  status: { type: String, enum: ['open', 'locked', 'cancelled', 'completed'], default: 'open' },
  participants: [{
    userId: { type: Schema.Types.ObjectId, ref: 'User' },
    qty: { type: Number },
    joinedAt: { type: Date },
    orderId: { type: Schema.Types.ObjectId, ref: 'Transaction' },
    // Private fulfillment address — NEVER returned to other participants (service-level projection).
    deliveryAddress: {
      address: { type: String },
      coordinates: {
        lat: { type: Number },
        lng: { type: Number }
      }
    }
  }],
  lockedAt: { type: Date },
  cancelledAt: { type: Date },
  cancelReason: { type: String },
  deliveryId: { type: Schema.Types.ObjectId, ref: 'Delivery' },
  deletedAt: { type: Date, default: null }
}, { timestamps: true });

groupBuySchema.index({ productId: 1, status: 1, deadline: 1 });
groupBuySchema.index({ marketId: 1, status: 1 });
groupBuySchema.index({ sellerId: 1, status: 1 });

export const GroupBuy = mongoose.models.GroupBuy || model('GroupBuy', groupBuySchema);
