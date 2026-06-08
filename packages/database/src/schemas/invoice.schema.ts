import mongoose, { Schema, model } from 'mongoose';

// Monthly consolidated invoice for a B2B account (INVOICE billing method).
// invoiceNumber format: INV-YYYYMM-XXXX.
export const invoiceSchema = new Schema({
  invoiceNumber: { type: String, required: true, unique: true },
  b2bAccountId: { type: Schema.Types.ObjectId, ref: 'B2BAccount', required: true },
  buyerUserId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  sellerId: { type: Schema.Types.ObjectId, ref: 'SellerProfile', required: true },
  periodStart: { type: Date },
  periodEnd: { type: Date },
  lineItems: [{
    orderNumber: { type: String },
    orderId: { type: Schema.Types.ObjectId, ref: 'Transaction' },
    date: { type: Date },
    description: { type: String },
    amount: { type: Number }
  }],
  subtotal: { type: Number },
  taxAmount: { type: Number, default: 0 },
  totalAmount: { type: Number },
  status: { type: String, enum: ['pending', 'paid', 'overdue', 'cancelled'], default: 'pending' },
  dueDate: { type: Date },
  paidAt: { type: Date },
  pdfUrl: { type: String },
  notes: { type: String },
  deletedAt: { type: Date, default: null }
}, { timestamps: true });

// invoiceNumber uniqueness already creates an index via unique:true above.
invoiceSchema.index({ b2bAccountId: 1, status: 1 });
invoiceSchema.index({ status: 1, dueDate: 1 });

export const Invoice = mongoose.models.Invoice || model('Invoice', invoiceSchema);
