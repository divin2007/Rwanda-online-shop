import mongoose, { Schema, model } from 'mongoose';

// An export buyer's inquiry to a seller. Seller contact info is revealed only after the
// buyer is verified (User.isExportBuyer) — enforced at the service layer.
export const exportInquirySchema = new Schema({
  exportBuyerUserId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  sellerId: { type: Schema.Types.ObjectId, ref: 'SellerProfile', required: true },
  products: [{
    productId: { type: Schema.Types.ObjectId, ref: 'Product' },
    quantity: { type: Number },
    unit: { type: String }
  }],
  documentsRequested: [{
    type: { type: String, enum: ['CERTIFICATE_OF_ORIGIN', 'PACKING_LIST', 'PHYTOSANITARY', 'INVOICE'] },
    status: { type: String, enum: ['pending', 'ready', 'sent'], default: 'pending' }
  }],
  totalEstimatedValue: { type: Number },
  deliveryCountry: { type: String },
  notes: { type: String },
  status: { type: String, enum: ['pending', 'in_review', 'fulfilled', 'rejected'], default: 'pending' },
  adminNotes: { type: String },
  handledBy: { type: Schema.Types.ObjectId, ref: 'User' },
  deletedAt: { type: Date, default: null }
}, { timestamps: true });

exportInquirySchema.index({ exportBuyerUserId: 1, status: 1 });
exportInquirySchema.index({ sellerId: 1, status: 1 });

export const ExportInquiry = mongoose.models.ExportInquiry || model('ExportInquiry', exportInquirySchema);
