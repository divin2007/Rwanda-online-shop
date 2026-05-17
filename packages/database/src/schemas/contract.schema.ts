import mongoose, { Schema, model } from 'mongoose';

export const contractSchema = new Schema({
  version: { type: String, required: true, unique: true },
  active: { type: Boolean, default: false, index: true },
  publishedAt: { type: Date, required: true },
  content: { type: String, required: true },
  changelog: [{ type: String }],
}, { timestamps: true });

contractSchema.index({ active: 1, publishedAt: -1 });

export const Contract = mongoose.models.Contract || model('Contract', contractSchema);
