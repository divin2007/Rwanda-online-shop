import { Schema, model } from 'mongoose';
import { UserRole } from '@rmf/shared-types';

export const userSchema = new Schema({
  fullName: { type: String, required: true },
  email: { type: String, required: true, unique: true },
  phone: { type: String, required: true, unique: true },
  passwordHash: { type: String, required: true },
  googleId: { type: String },
  role: { 
    type: String, 
    enum: Object.values(UserRole), 
    required: true,
    default: UserRole.BUYER
  },
  isVerified: { type: Boolean, default: false },
  isActive: { type: Boolean, default: true },
  avatarUrl: { type: String },
  wishlist: [{ type: Schema.Types.ObjectId, ref: 'Product' }],
  referralCode: { type: String, unique: true, sparse: true },
  referredBy: { type: String }, // Stores the code of the user who referred them
  referralEarnings: { type: Number, default: 0 },
  devices: [{ 
    token: String, 
    platform: String, 
    lastUsed: Date 
  }],
  security: {
    lastLoginAt: Date,
    lastLoginIp: String,
    failedLoginAttempts: { type: Number, default: 0 },
    lockedUntil: Date,
    passwordChangedAt: Date,
    twoFactorEnabled: { type: Boolean, default: false }
  },
  deletedAt: { type: Date, default: null } // Soft delete
}, { timestamps: true });

export const User = model('User', userSchema);
