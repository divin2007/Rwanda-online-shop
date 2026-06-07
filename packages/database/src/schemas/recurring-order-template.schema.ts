import mongoose, { Schema, model } from 'mongoose';

// A standing order template for a B2B account. A daily cron materializes due templates
// into Transactions (orderSource='b2b_recurring').
export const recurringOrderTemplateSchema = new Schema({
  b2bAccountId: { type: Schema.Types.ObjectId, ref: 'B2BAccount', required: true },
  buyerUserId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  sellerId: { type: Schema.Types.ObjectId, ref: 'SellerProfile', required: true },
  marketId: { type: Schema.Types.ObjectId, ref: 'Market', required: true },
  items: [{
    productId: { type: Schema.Types.ObjectId, ref: 'Product' },
    name: { type: String },
    unitPrice: { type: Number },
    quantity: { type: Number },
    unit: { type: String }
  }],
  frequency: { type: String, enum: ['daily', 'weekly'], required: true },
  dayOfWeek: { type: Number },
  timeWindow: {
    hour: { type: Number },
    minute: { type: Number }
  },
  billingMethod: { type: String, enum: ['MOMO', 'INVOICE'], default: 'MOMO' },
  isActive: { type: Boolean, default: true },
  nextRunAt: { type: Date },
  lastRunAt: { type: Date },
  deletedAt: { type: Date, default: null }
}, { timestamps: true });

recurringOrderTemplateSchema.index({ b2bAccountId: 1, isActive: 1 });
recurringOrderTemplateSchema.index({ isActive: 1, nextRunAt: 1 });

export const RecurringOrderTemplate = mongoose.models.RecurringOrderTemplate || model('RecurringOrderTemplate', recurringOrderTemplateSchema);
