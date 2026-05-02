import { Schema, model } from 'mongoose';

export const productSchema = new Schema({
  sellerId: { type: Schema.Types.ObjectId, ref: 'SellerProfile', required: true },
  marketId: { type: Schema.Types.ObjectId, ref: 'Market', required: true },
  name: { type: String, required: true },
  description: { type: String },
  category: { type: String, required: true },
  price: { type: Number, required: true },
  unit: { type: String, required: true },
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
  rating: { type: Number, default: 0 },
  totalOrders: { type: Number, default: 0 },
  deletedAt: { type: Date, default: null }
}, { timestamps: true });

export const Product = model('Product', productSchema);
