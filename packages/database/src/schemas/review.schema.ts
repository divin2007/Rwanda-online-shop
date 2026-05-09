import { Schema, model } from 'mongoose';

export const reviewSchema = new Schema({
  orderId: { type: Schema.Types.ObjectId, ref: 'Transaction', required: true, unique: true },
  buyerId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  targetType: { type: String, enum: ['seller', 'rider', 'market', 'product'], required: true },
  targetId: { type: Schema.Types.ObjectId, required: true }, // ref to SellerProfile or RiderProfile
  rating: { type: Number, required: true, min: 1, max: 5 },
  comment: { type: String },
  deletedAt: { type: Date, default: null }
}, { timestamps: true });

export const Review = model('Review', reviewSchema);
