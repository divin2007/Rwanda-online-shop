import mongoose, { Schema, model } from 'mongoose';

// B2B procurement account (hotels, restaurants, caterers, schools, offices, NGOs).
// Credit limit enforcement must be atomic (findOneAndUpdate with currentMonthCredit pre-condition).
export const b2bAccountSchema = new Schema({
  userId: { type: Schema.Types.ObjectId, ref: 'User', required: true, unique: true },
  organizationName: { type: String, required: true },
  organizationType: { type: String, enum: ['HOTEL', 'RESTAURANT', 'CATERER', 'SCHOOL', 'OFFICE', 'NGO'], required: true },
  contactPhone: { type: String },
  taxId: { type: String },
  verificationDocUrl: { type: String },
  isVerified: { type: Boolean, default: false },
  verifiedAt: { type: Date },
  verifiedBy: { type: Schema.Types.ObjectId, ref: 'User' },
  creditLimit: { type: Number, default: 0 },
  currentMonthCredit: { type: Number, default: 0 },
  billingMethod: { type: String, enum: ['MOMO', 'INVOICE'], default: 'MOMO' },
  monthlyInvoiceEnabled: { type: Boolean, default: false },
  deletedAt: { type: Date, default: null }
}, { timestamps: true });

export const B2BAccount = mongoose.models.B2BAccount || model('B2BAccount', b2bAccountSchema);
