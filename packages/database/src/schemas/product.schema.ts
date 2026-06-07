import mongoose, { Schema, model } from 'mongoose';

export const productSchema = new Schema({
  sellerId: { type: Schema.Types.ObjectId, ref: 'SellerProfile', required: true },
  marketId: { type: Schema.Types.ObjectId, ref: 'Market', required: true },
  name: { type: String, required: true },
  description: { type: String },
  category: { type: String, required: true },
  categoryId: { type: String, required: true, default: 'other' },
  categoryLabel: { type: String, required: true, default: 'Other' },
  productType: { type: String, required: true, default: 'other' },
  attributeSetVersion: { type: Number, default: 1 },
  price: { type: Number, required: true },
  priceUpdatedAt: { type: Date, default: Date.now },
  unit: { type: String, required: true },
  stockType: { type: String, enum: ['finite', 'infinite', 'on_demand'], default: 'finite' },
  stockQuantity: { type: Number, required: true, default: 0 },
  inStock: { type: Boolean, default: true },
  images: { 
    type: [String], 
    required: true,
    validate: [
      (val: string[]) => val.length > 0,
      'Products must have at least one image'
    ]
  },
  weight: { type: Number }, // in kg
  minWeight: { type: Number },
  maxWeight: { type: Number },
  minPrice: { type: Number },
  maxPrice: { type: Number },
  attributes: { type: Map, of: Schema.Types.Mixed },
  variantAxes: [{
    key: { type: String, required: true },
    label: { type: String, required: true },
    values: [{ type: String }]
  }],
  variants: [{
    sku: { type: String },
    title: { type: String },
    options: { type: Map, of: String },
    price: { type: Number },
    unit: { type: String },
    stockType: { type: String, enum: ['finite', 'infinite', 'on_demand'], default: 'finite' },
    stockQuantity: { type: Number, default: 0 },
    inStock: { type: Boolean, default: true },
    images: [{ type: String }],
    videoUrl: { type: String },
    thumbnailUrl: { type: String },
    attributes: { type: Map, of: Schema.Types.Mixed },
    isActive: { type: Boolean, default: true }
  }],
  isApproved: { type: Boolean, default: true },
  isActive: { type: Boolean, default: true },
  // isMadeInRwanda doubles as the export-eligibility flag (no separate exportReady on Product).
  isMadeInRwanda: { type: Boolean, default: false },
  isNegotiable: { type: Boolean, default: false },
  // Product condition grading (Phase 3) for second-hand / refurbished transparency.
  // null = unspecified (treated as new for legacy products).
  condition: { type: String, enum: ['new', 'grade_a', 'grade_b', 'grade_c', 'refurbished'], default: null },
  qualityNotes: { type: String, maxlength: 500 },
  // Cold-chain / perishable.
  perishable: { type: Boolean, default: false },
  maxDeliveryMinutes: { type: Number },
  // Export facilitation.
  exportMinQty: { type: Number },
  // Group buying.
  groupBuyEligible: { type: Boolean, default: false },
  groupBuyMinQty: { type: Number },
  groupBuyDiscountPercent: { type: Number },
  rating: { type: Number, default: 0 },
  totalOrders: { type: Number, default: 0 },
  deletedAt: { type: Date, default: null },
  deletedBy: { type: String, default: null },
  deletionReason: { type: String, default: null },
  auditTrail: [{
    action: { type: String, required: true },
    actorId: { type: String, default: null },
    reason: { type: String, default: null },
    at: { type: Date, default: Date.now }
  }]
}, { timestamps: true });

productSchema.index({ sellerId: 1, deletedAt: 1 });
productSchema.index({ sellerId: 1, isActive: 1, isApproved: 1, deletedAt: 1 });
productSchema.index({ marketId: 1, deletedAt: 1 });
productSchema.index({ marketId: 1, isActive: 1, isApproved: 1, deletedAt: 1 });
productSchema.index({ isActive: 1, isApproved: 1, deletedAt: 1 });
productSchema.index({ category: 1, deletedAt: 1 });
productSchema.index({ categoryId: 1, deletedAt: 1 });
productSchema.index({ categoryId: 1, isActive: 1, isApproved: 1, deletedAt: 1 });
productSchema.index({ productType: 1, deletedAt: 1 });
productSchema.index({ productType: 1, isActive: 1, isApproved: 1, deletedAt: 1 });
productSchema.index({ isMadeInRwanda: 1, isActive: 1, isApproved: 1, deletedAt: 1 });
productSchema.index({ 'attributes.$**': 1 });
productSchema.index({ 'variants.sku': 1 }, { sparse: true });
productSchema.index({ createdAt: -1 });
// Condition filtering (Phase 3).
productSchema.index({ condition: 1 });
// Full-text search ranking. Used by GET /products/search.
productSchema.index(
  { name: 'text', description: 'text', category: 'text' },
  { weights: { name: 10, category: 5, description: 1 }, default_language: 'english', name: 'product_text_search' },
);

export const Product = mongoose.models.Product || model('Product', productSchema);
