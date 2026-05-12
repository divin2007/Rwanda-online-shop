import mongoose, { Schema, model } from 'mongoose';

export const productSchema = new Schema({
  sellerId: { type: Schema.Types.ObjectId, ref: 'SellerProfile', required: true },
  marketId: { type: Schema.Types.ObjectId, ref: 'Market', required: true },
  name: { type: String, required: true },
  description: { type: String },
  category: { type: String, required: true },
  price: { type: Number, required: true },
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
  attributes: { type: Map, of: Schema.Types.Mixed },
  isApproved: { type: Boolean, default: false },
  isActive: { type: Boolean, default: true },
  isMadeInRwanda: { type: Boolean, default: false },
  isNegotiable: { type: Boolean, default: false },
  rating: { type: Number, default: 0 },
  totalOrders: { type: Number, default: 0 },
  deletedAt: { type: Date, default: null }
}, { timestamps: true });

productSchema.index({ sellerId: 1, deletedAt: 1 });
productSchema.index({ marketId: 1, deletedAt: 1 });
productSchema.index({ isActive: 1, isApproved: 1, deletedAt: 1 });
productSchema.index({ category: 1, deletedAt: 1 });
productSchema.index({ createdAt: -1 });

export const Product = mongoose.models.Product || model('Product', productSchema);
