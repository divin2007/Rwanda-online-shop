import mongoose, { Schema, model } from 'mongoose';

export const reviewSchema = new Schema({
  orderId: { type: Schema.Types.ObjectId, ref: 'Transaction', required: true },
  buyerId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  targetType: { type: String, enum: ['seller', 'rider', 'market', 'product'], required: true },
  targetId: { type: Schema.Types.ObjectId, required: true },
  rating: { type: Number, required: true, min: 1, max: 5 },
  comment: { type: String },
  deletedAt: { type: Date, default: null }
}, { timestamps: true });

reviewSchema.index({ orderId: 1, targetType: 1, targetId: 1 }, { unique: true });

export const Review = mongoose.models.Review || model('Review', reviewSchema);
