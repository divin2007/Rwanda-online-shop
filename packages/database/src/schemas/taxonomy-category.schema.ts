import mongoose, { Schema, model } from 'mongoose';

const catalogFieldSchema = new Schema({
  key: { type: String, required: true },
  label: { type: String, required: true },
  type: { type: String, enum: ['text', 'number', 'select', 'multi_select', 'boolean', 'date', 'color'], required: true },
  required: { type: Boolean, default: false },
  unit: { type: String },
  options: [{ type: String }],
  min: { type: Number },
  max: { type: Number },
  searchable: { type: Boolean, default: false },
  filterable: { type: Boolean, default: false },
}, { _id: false });

export const taxonomyCategorySchema = new Schema({
  id: { type: String, required: true, unique: true, lowercase: true, trim: true },
  label: { type: String, required: true, trim: true },
  productType: { type: String, required: true, lowercase: true, trim: true },
  defaultUnit: { type: String, required: true, default: 'pcs' },
  aliases: [{ type: String, lowercase: true, trim: true }],
  synonyms: [{ type: String, lowercase: true, trim: true }],
  searchBoost: { type: Number, default: 1 },
  parentId: { type: String, default: null, lowercase: true, trim: true },
  variantAxes: [catalogFieldSchema],
  attributes: [catalogFieldSchema],
  isActive: { type: Boolean, default: true },
  version: { type: Number, default: 1 },
  createdBy: { type: String, default: null },
  updatedBy: { type: String, default: null },
  deletedAt: { type: Date, default: null },
  auditTrail: [{
    action: { type: String, required: true },
    actorId: { type: String, default: null },
    reason: { type: String, default: null },
    at: { type: Date, default: Date.now },
  }],
}, { timestamps: true });

taxonomyCategorySchema.index({ id: 1, deletedAt: 1 });
taxonomyCategorySchema.index({ parentId: 1 });
taxonomyCategorySchema.index({ productType: 1, deletedAt: 1 });
taxonomyCategorySchema.index({ aliases: 1 });
taxonomyCategorySchema.index({ synonyms: 1 });

export const TaxonomyCategory = mongoose.models.TaxonomyCategory || model('TaxonomyCategory', taxonomyCategorySchema);
