import { BadRequestException, Injectable, ConflictException, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import * as bcrypt from 'bcrypt';
import { UserRole } from '@rmf/shared-types';

type UserPreferences = {
  language: 'en' | 'fr' | 'kin';
  currency: 'RWF' | 'USD' | 'EUR';
  notifications: {
    inApp: boolean;
    email: boolean;
    sms: boolean;
    whatsapp: boolean;
    orderUpdates: boolean;
    promotions: boolean;
    securityAlerts: boolean;
    customMessagesEmailOnly: boolean;
  };
  privacy: {
    showProfilePhoto: boolean;
    sharePhoneWithOrderParties: boolean;
  };
  seller: {
    autoReplyEnabled: boolean;
    autoReplyMessage: string;
    quoteExpiryHours: number;
  };
  rider: {
    autoAcceptNearby: boolean;
    maxPickupDistanceKm: number;
  };
};

const preferenceDefaults: UserPreferences = {
  language: 'en',
  currency: 'RWF',
  notifications: {
    inApp: true,
    email: true,
    sms: false,
    whatsapp: false,
    orderUpdates: true,
    promotions: false,
    securityAlerts: true,
    customMessagesEmailOnly: false,
  },
  privacy: {
    showProfilePhoto: true,
    sharePhoneWithOrderParties: true,
  },
  seller: {
    autoReplyEnabled: false,
    autoReplyMessage: '',
    quoteExpiryHours: 24,
  },
  rider: {
    autoAcceptNearby: false,
    maxPickupDistanceKm: 8,
  },
};

const asBoolean = (value: unknown, fallback: boolean) => (typeof value === 'boolean' ? value : fallback);
const clampNumber = (value: unknown, fallback: number, min: number, max: number) => {
  const numberValue = typeof value === 'number' ? value : Number(value);
  if (!Number.isFinite(numberValue)) return fallback;
  return Math.min(max, Math.max(min, Math.round(numberValue)));
};
const safeText = (value: unknown, maxLength: number) => {
  if (typeof value !== 'string') return '';
  return value.replace(/[\u0000-\u001f\u007f]/g, '').trim().slice(0, maxLength);
};
const sanitizePreferences = (raw: any): UserPreferences => {
  const current = raw || {};
  const notifications = current.notifications || {};
  const privacy = current.privacy || {};
  const seller = current.seller || {};
  const rider = current.rider || {};
  const language = ['en', 'fr', 'kin'].includes(current.language) ? current.language : preferenceDefaults.language;
  const currency = ['RWF', 'USD', 'EUR'].includes(current.currency) ? current.currency : preferenceDefaults.currency;

  return {
    language,
    currency,
    notifications: {
      inApp: asBoolean(notifications.inApp, preferenceDefaults.notifications.inApp),
      email: asBoolean(notifications.email, preferenceDefaults.notifications.email),
      sms: asBoolean(notifications.sms, preferenceDefaults.notifications.sms),
      whatsapp: asBoolean(notifications.whatsapp, preferenceDefaults.notifications.whatsapp),
      orderUpdates: asBoolean(notifications.orderUpdates, preferenceDefaults.notifications.orderUpdates),
      promotions: asBoolean(notifications.promotions, preferenceDefaults.notifications.promotions),
      securityAlerts: asBoolean(notifications.securityAlerts, preferenceDefaults.notifications.securityAlerts),
      customMessagesEmailOnly: asBoolean(notifications.customMessagesEmailOnly, preferenceDefaults.notifications.customMessagesEmailOnly),
    },
    privacy: {
      showProfilePhoto: asBoolean(privacy.showProfilePhoto, preferenceDefaults.privacy.showProfilePhoto),
      sharePhoneWithOrderParties: asBoolean(privacy.sharePhoneWithOrderParties, preferenceDefaults.privacy.sharePhoneWithOrderParties),
    },
    seller: {
      autoReplyEnabled: asBoolean(seller.autoReplyEnabled, preferenceDefaults.seller.autoReplyEnabled),
      autoReplyMessage: safeText(seller.autoReplyMessage, 240),
      quoteExpiryHours: clampNumber(seller.quoteExpiryHours, preferenceDefaults.seller.quoteExpiryHours, 1, 168),
    },
    rider: {
      autoAcceptNearby: asBoolean(rider.autoAcceptNearby, preferenceDefaults.rider.autoAcceptNearby),
      maxPickupDistanceKm: clampNumber(rider.maxPickupDistanceKm, preferenceDefaults.rider.maxPickupDistanceKm, 1, 40),
    },
  };
};

@Injectable()
export class UsersService {
  constructor(
    @InjectModel('User') private userModel: Model<any>,
    @InjectModel('SupportTicket') private supportTicketModel: Model<any>
  ) {}

  async createSupportTicket(ticketData: any): Promise<any> {
    const ticket = new this.supportTicketModel(ticketData);
    const savedTicket = await ticket.save();

    // Send email to admin
    try {
      const axios = require('axios');
      const notificationUrl = process.env.NOTIFICATION_SERVICE_URL || 'http://localhost:3009/api/v1';
      await axios.post(`${notificationUrl}/notifications/email`, {
        email: 'admin@rwanda-online-shop.com', // fallback admin email
        type: 'admin.support_ticket_created',
        params: { 
          ticketId: savedTicket._id.toString(),
          name: ticketData.name,
          userEmail: ticketData.email,
          subject: ticketData.subject,
          message: ticketData.message
        }
      });
    } catch (e: any) {
      console.warn(`[UsersService] Failed to send admin notification for ticket ${savedTicket._id}: ${e.message}`);
    }

    return savedTicket;
  }

  async create(userData: any): Promise<any> {
    // 1C fix: build dedup filter carefully — only include phone if actually provided.
    // Google OAuth users have phone=undefined, which would match any other user with no phone.
    const dedupFilter: any[] = [{ email: userData.email }];
    if (userData.phone) {
      dedupFilter.push({ phone: userData.phone });
    }
    const existingUser = await this.userModel.findOne({ $or: dedupFilter });

    if (existingUser) {
      throw new ConflictException('Email or phone already exists');
    }

    const salt = await bcrypt.genSalt(10);
    const passwordHash = await bcrypt.hash(userData.password, salt);

    // 1E fix: referral code generation with collision retry (up to 3 attempts).
    let referralCode = '';
    for (let attempt = 0; attempt < 3; attempt++) {
      const codeBase = (userData.fullName || 'USR').substring(0, 3).toUpperCase().replace(/[^A-Z]/g, 'X');
      const randomChars = Math.random().toString(36).substring(2, 7).toUpperCase();
      referralCode = `${codeBase}-${randomChars}`;
      const collision = await this.userModel.findOne({ referralCode }).lean();
      if (!collision) break;
      if (attempt === 2) {
        // Last attempt — append timestamp fragment to guarantee uniqueness
        referralCode = `${referralCode}-${Date.now().toString(36).slice(-3).toUpperCase()}`;
      }
    }

    const newUser = new this.userModel({
      ...userData,
      passwordHash,
      role: userData.role || UserRole.BUYER,
      referralCode,
      referredBy: userData.referredBy || null
    });

    const savedUser = await newUser.save();
    const userObj = savedUser.toObject();
    delete userObj.passwordHash;

    // 1B fix: ensure wallet exists for the new user (fire-and-forget)
    this.ensureWallet(userObj._id.toString()).catch(() => {});
    // 1D fix: send welcome notification (fire-and-forget)
    this.sendWelcomeNotification(userObj._id.toString(), userObj.fullName).catch(() => {});

    return userObj;
  }

  // 1B fix: create wallet for new user so balance queries never fail
  private async ensureWallet(userId: string) {
    try {
      const axios = require('axios');
      const walletUrl = process.env.WALLET_SERVICE_URL || 'http://localhost:3007/api/v1';
      await axios.get(`${walletUrl}/wallets/${userId}/balance`);
    } catch (e: any) {
      console.warn(`[UsersService] Wallet init for ${userId}: ${e.message}`);
    }
  }

  // 1D fix: send welcome notification after registration
  private async sendWelcomeNotification(userId: string, fullName: string) {
    try {
      const axios = require('axios');
      const notificationUrl = process.env.NOTIFICATION_SERVICE_URL || 'http://localhost:3009/api/v1';
      await axios.post(`${notificationUrl}/notifications/in-app`, {
        userId,
        type: 'welcome',
        params: { fullName, message: `Welcome to Rwanda Marketplace, ${fullName}! Start exploring local markets and products.` }
      });
    } catch (e: any) {
      console.warn(`[UsersService] Welcome notification for ${userId}: ${e.message}`);
    }
  }

  async findByEmail(email: string): Promise<any> {
    return this.userModel.findOne({ email }).exec();
  }

  async findById(id: string): Promise<any> {
    const user = await this.userModel.findById(id).exec();
    if (!user) {
      throw new NotFoundException('User not found');
    }
    return user;
  }

  async updateLoginAttempts(email: string, isSuccess: boolean): Promise<void> {
    if (isSuccess) {
      await this.userModel.updateOne(
        { email },
        { 
          $set: { 'security.failedLoginAttempts': 0, 'security.lastLoginAt': new Date() },
          $unset: { 'security.lockedUntil': 1 }
        }
      );
    } else {
      const user = await this.userModel.findOne({ email });
      if (user) {
        const attempts = (user.security?.failedLoginAttempts || 0) + 1;
        const updates: any = { 'security.failedLoginAttempts': attempts };
        
        // Lockout after 5 failed attempts for 15 minutes
        if (attempts >= 5) {
          const lockedUntil = new Date();
          lockedUntil.setMinutes(lockedUntil.getMinutes() + 15);
          updates['security.lockedUntil'] = lockedUntil;
        }
        
        await this.userModel.updateOne({ email }, { $set: updates });
      }
    }
  }

  async addToWishlist(userId: string, productId: string): Promise<any> {
    if (!Types.ObjectId.isValid(userId) || !Types.ObjectId.isValid(productId)) {
      throw new BadRequestException('Invalid wishlist request');
    }
    return this.userModel.findByIdAndUpdate(
      userId,
      { $addToSet: { wishlist: productId } },
      { new: true }
    ).exec();
  }

  async removeFromWishlist(userId: string, productId: string): Promise<any> {
    if (!Types.ObjectId.isValid(userId) || !Types.ObjectId.isValid(productId)) {
      throw new BadRequestException('Invalid wishlist request');
    }
    return this.userModel.findByIdAndUpdate(
      userId,
      { $pull: { wishlist: productId } },
      { new: true }
    ).exec();
  }

  async getWishlist(userId: string): Promise<any> {
    if (!userId || userId === 'undefined' || !Types.ObjectId.isValid(userId)) {
      console.warn('[UserService] getWishlist called with invalid userId');
      throw new BadRequestException('Invalid user ID');
    }
    
    try {
      const user = await this.userModel.findById(userId).exec();
      if (!user) throw new NotFoundException('User not found');
      return user.wishlist || [];
    } catch (error) {
      console.error(`[UserService] Error fetching wishlist for user ${userId}:`, error.message);
      if (error.name === 'CastError') throw new NotFoundException('User ID format invalid');
      if (error instanceof NotFoundException) throw error;
      throw error;
    }
  }

  async getSettings(userId: string): Promise<any> {
    const user = await this.findById(userId);
    return sanitizePreferences(user.preferences);
  }

  async updateSettings(userId: string, preferences: any): Promise<any> {
    if (!Types.ObjectId.isValid(userId)) {
      throw new BadRequestException('Invalid user ID');
    }

    const sanitized = sanitizePreferences(preferences);

    const updated = await this.userModel.findByIdAndUpdate(
      userId,
      { $set: { preferences: sanitized } },
      { new: true }
    ).exec();

    if (!updated) throw new NotFoundException('User not found');
    return sanitizePreferences(updated.preferences);
  }

  // 3F fix: update user role (called by seller-service / rider-service after admin approval)
  async updateRole(userId: string, role: string): Promise<any> {
    const updated = await this.userModel.findByIdAndUpdate(
      userId,
      { $set: { role } },
      { new: true }
    ).exec();
    if (!updated) throw new NotFoundException('User not found');
    return updated;
  }

  // 1A fix: send email verification code
  async sendVerificationCode(userId: string): Promise<{ sent: boolean }> {
    const user = await this.userModel.findById(userId).exec();
    if (!user) throw new NotFoundException('User not found');

    if (user.emailVerified) {
      return { sent: false }; // Already verified
    }

    // Generate 6-digit code with 15 minute expiry
    const code = String(Math.floor(100000 + Math.random() * 900000));
    const expiresAt = new Date(Date.now() + 15 * 60 * 1000);

    await this.userModel.findByIdAndUpdate(userId, {
      $set: {
        'emailVerification.code': code,
        'emailVerification.expiresAt': expiresAt,
        'emailVerification.attempts': 0
      }
    });

    // Send verification email via notification-service
    try {
      const axios = require('axios');
      const notificationUrl = process.env.NOTIFICATION_SERVICE_URL || 'http://localhost:3009/api/v1';
      await axios.post(`${notificationUrl}/notifications/email`, {
        userId,
        email: user.email,
        type: 'email.verification',
        params: { code, fullName: user.fullName, expiresInMinutes: 15 }
      });
    } catch (e: any) {
      console.warn(`[UsersService] Verification email failed for ${userId}: ${e.message}`);
    }

    return { sent: true };
  }

  // 1A fix: verify email with code
  async verifyEmail(userId: string, code: string): Promise<{ verified: boolean }> {
    const user = await this.userModel.findById(userId).exec();
    if (!user) throw new NotFoundException('User not found');

    if (user.emailVerified) {
      return { verified: true }; // Already verified
    }

    const verification = user.emailVerification;
    if (!verification?.code) {
      throw new BadRequestException('No verification code sent. Request a new one.');
    }

    // Rate limit: max 5 attempts per code
    if ((verification.attempts || 0) >= 5) {
      throw new BadRequestException('Too many attempts. Request a new verification code.');
    }

    // Check expiry
    if (new Date() > new Date(verification.expiresAt)) {
      throw new BadRequestException('Verification code has expired. Request a new one.');
    }

    // Increment attempts
    await this.userModel.findByIdAndUpdate(userId, {
      $inc: { 'emailVerification.attempts': 1 }
    });

    if (verification.code !== code) {
      throw new BadRequestException('Invalid verification code.');
    }

    // Mark email as verified
    await this.userModel.findByIdAndUpdate(userId, {
      $set: { emailVerified: true },
      $unset: { emailVerification: 1 }
    });

    return { verified: true };
  }
}
