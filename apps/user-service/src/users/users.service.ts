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
  discovery: {
    categoryIds: string[];
    marketIds: string[];
    onboardingCompleted: boolean;
    updatedAt?: Date;
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
  discovery: {
    categoryIds: [],
    marketIds: [],
    onboardingCompleted: false,
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
const normalizeCategoryId = (value: unknown) => String(value || '')
  .trim()
  .toLowerCase()
  .replace(/[^a-z0-9_-]+/g, '-')
  .replace(/^-+|-+$/g, '')
  .slice(0, 80);
const uniqueCleanCategories = (value: unknown) => Array.from(new Set(
  (Array.isArray(value) ? value : String(value || '').split(','))
    .map(normalizeCategoryId)
    .filter(Boolean),
)).slice(0, 30);
const uniqueObjectIds = (value: unknown) => Array.from(new Set(
  (Array.isArray(value) ? value : String(value || '').split(','))
    .map(item => String(item || '').trim())
    .filter(item => Types.ObjectId.isValid(item)),
)).slice(0, 30);
const sanitizePreferences = (raw: any): UserPreferences => {
  const current = raw || {};
  const notifications = current.notifications || {};
  const privacy = current.privacy || {};
  const seller = current.seller || {};
  const rider = current.rider || {};
  const discovery = current.discovery || {};
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
    discovery: {
      categoryIds: uniqueCleanCategories(discovery.categoryIds),
      marketIds: uniqueObjectIds(discovery.marketIds),
      onboardingCompleted: asBoolean(discovery.onboardingCompleted, false),
      updatedAt: discovery.updatedAt ? new Date(discovery.updatedAt) : undefined,
    },
  };
};

const interactionWeights: Record<string, number> = {
  view: 1,
  product_view: 2,
  market_view: 1.5,
  video_view: 1.25,
  video_like: 4,
  video_comment: 5,
  wishlist: 6,
  like: 6,
  add_to_cart: 8,
  purchase: 12,
  dislike: -4,
  dismiss: -2,
};

const upsertSignal = (items: any[], keyName: 'key' | 'refId', key: string, delta: number) => {
  if (!key) return items;
  const normalized = keyName === 'key' ? normalizeCategoryId(key) : key;
  const current = Array.isArray(items) ? [...items] : [];
  const found = current.find(item => String(item?.[keyName]) === normalized);
  if (found) {
    found.score = Math.max(-20, Math.min(1000, Number(found.score || 0) + delta));
    found.lastSeenAt = new Date();
  } else {
    current.push({
      [keyName]: keyName === 'refId' ? new Types.ObjectId(normalized) : normalized,
      score: Math.max(-20, Math.min(1000, delta)),
      lastSeenAt: new Date(),
    });
  }
  return current
    .filter(item => Number(item.score || 0) > -20)
    .sort((a, b) => Number(b.score || 0) - Number(a.score || 0))
    .slice(0, 80);
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
      const secret = process.env.INTERNAL_SERVICE_SECRET;
      const headers = secret ? { 'x-internal-service-key': secret } : {};
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
      }, { headers });
      await axios.post(`${notificationUrl}/notifications/admin-notify`, {
        type: 'admin.support_ticket_created',
        params: {
          ticketId: savedTicket._id.toString(),
          name: ticketData.name,
          userEmail: ticketData.email,
          subject: ticketData.subject,
          message: ticketData.message,
        },
      }, { headers }).catch(() => undefined);
      if (ticketData.userId) {
        await axios.post(`${notificationUrl}/notifications/in-app`, {
          userId: ticketData.userId,
          type: 'support.message.sent',
          params: {
            ticketId: savedTicket._id.toString(),
            referenceId: savedTicket._id.toString(),
            referenceType: 'SupportTicket',
            subject: ticketData.subject,
            preview: String(ticketData.message || '').slice(0, 120),
          },
        }, { headers }).catch(() => undefined);
      }
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

    const requestedCategoryIds = uniqueCleanCategories(userData.preferredCategoryIds || userData.categoryIds);
    const requestedMarketIds = uniqueObjectIds(userData.preferredMarketIds || userData.marketIds);
    const initialPreferences = sanitizePreferences({
      ...(userData.preferences || {}),
      discovery: {
        ...(userData.preferences?.discovery || {}),
        categoryIds: requestedCategoryIds,
        marketIds: requestedMarketIds,
        onboardingCompleted: requestedCategoryIds.length > 0 || requestedMarketIds.length > 0,
        updatedAt: new Date(),
      },
    });

    const newUser = new this.userModel({
      ...userData,
      passwordHash,
      role: userData.role || UserRole.BUYER,
      referralCode,
      referredBy: userData.referredBy || null,
      preferences: initialPreferences,
      recommendationProfile: {
        categoryScores: requestedCategoryIds.map((key: string) => ({ key, score: 20, lastSeenAt: new Date() })),
        marketScores: requestedMarketIds.map((refId: string) => ({ refId: new Types.ObjectId(refId), score: 12, lastSeenAt: new Date() })),
        recentProductIds: [],
        lastInteractionAt: requestedCategoryIds.length || requestedMarketIds.length ? new Date() : undefined,
      },
    });

    const savedUser = await newUser.save();
    const userObj = savedUser.toObject();
    delete userObj.passwordHash;

    // 1D fix: send welcome notification (fire-and-forget)
    this.sendWelcomeNotification(userObj._id.toString(), userObj.fullName).catch(() => {});

    return userObj;
  }

  // 1D fix: send welcome notification after registration
  private async sendWelcomeNotification(userId: string, fullName: string) {
    try {
      const axios = require('axios');
      const notificationUrl = process.env.NOTIFICATION_SERVICE_URL || 'http://localhost:3009/api/v1';
      const secret = process.env.INTERNAL_SERVICE_SECRET;
      const headers = secret ? { 'x-internal-service-key': secret } : {};
      await axios.post(`${notificationUrl}/notifications/in-app`, {
        userId,
        type: 'welcome',
        params: { fullName, message: `Welcome to Rwanda Marketplace, ${fullName}! Start exploring local markets and products.` }
      }, { headers });
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
      const user = await this.userModel.findById(userId).populate('wishlist').exec();
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

    const existing = await this.findById(userId);
    const currentPreferences = existing.preferences?.toObject ? existing.preferences.toObject() : existing.preferences || {};
    const sanitized = sanitizePreferences({
      ...currentPreferences,
      ...(preferences || {}),
      notifications: { ...(currentPreferences.notifications || {}), ...(preferences?.notifications || {}) },
      privacy: { ...(currentPreferences.privacy || {}), ...(preferences?.privacy || {}) },
      seller: { ...(currentPreferences.seller || {}), ...(preferences?.seller || {}) },
      rider: { ...(currentPreferences.rider || {}), ...(preferences?.rider || {}) },
      discovery: { ...(currentPreferences.discovery || {}), ...(preferences?.discovery || {}) },
    });

    const updated = await this.userModel.findByIdAndUpdate(
      userId,
      { $set: { preferences: sanitized } },
      { new: true }
    ).exec();

    if (!updated) throw new NotFoundException('User not found');
    return sanitizePreferences(updated.preferences);
  }

  async getDiscoveryPreferences(userId: string): Promise<any> {
    const user = await this.findById(userId);
    const preferences = sanitizePreferences(user.preferences);
    return {
      ...preferences.discovery,
      recommendationProfile: {
        categoryScores: (user.recommendationProfile?.categoryScores || []).slice(0, 20),
        marketScores: (user.recommendationProfile?.marketScores || []).slice(0, 20),
        productScores: (user.recommendationProfile?.productScores || []).slice(0, 20),
      },
    };
  }

  async updateDiscoveryPreferences(userId: string, data: any): Promise<any> {
    if (!Types.ObjectId.isValid(userId)) {
      throw new BadRequestException('Invalid user ID');
    }
    const user = await this.findById(userId);
    const categoryIds = uniqueCleanCategories(data?.categoryIds);
    const marketIds = uniqueObjectIds(data?.marketIds);
    if (categoryIds.length === 0 && marketIds.length === 0) {
      throw new BadRequestException('Choose at least one category or market preference');
    }

    const currentPreferences = user.preferences?.toObject ? user.preferences.toObject() : user.preferences || {};
    const sanitized = sanitizePreferences({
      ...currentPreferences,
      discovery: {
        categoryIds,
        marketIds,
        onboardingCompleted: true,
        updatedAt: new Date(),
      },
    });

    const categoryScores = categoryIds.map((key: string) => ({ key, score: 20, lastSeenAt: new Date() }));
    const marketScores = marketIds.map((refId: string) => ({ refId: new Types.ObjectId(refId), score: 12, lastSeenAt: new Date() }));

    const updated = await this.userModel.findByIdAndUpdate(
      userId,
      {
        $set: {
          preferences: sanitized,
          'recommendationProfile.categoryScores': categoryScores,
          'recommendationProfile.marketScores': marketScores,
          'recommendationProfile.lastInteractionAt': new Date(),
        },
      },
      { new: true },
    ).exec();
    if (!updated) throw new NotFoundException('User not found');
    return this.getDiscoveryPreferences(userId);
  }

  async recordRecommendationInteraction(userId: string, data: any): Promise<any> {
    if (!Types.ObjectId.isValid(userId)) {
      throw new BadRequestException('Invalid user ID');
    }
    const user = await this.findById(userId);
    const action = safeText(data?.action || 'view', 40);
    const delta = interactionWeights[action] ?? 1;
    const profile = user.recommendationProfile || {};
    const nextProfile: any = {
      categoryScores: profile.categoryScores || [],
      marketScores: profile.marketScores || [],
      sellerScores: profile.sellerScores || [],
      productScores: profile.productScores || [],
      recentProductIds: Array.isArray(profile.recentProductIds) ? [...profile.recentProductIds] : [],
      lastInteractionAt: new Date(),
    };

    const categoryId = normalizeCategoryId(data?.categoryId || data?.category);
    if (categoryId) nextProfile.categoryScores = upsertSignal(nextProfile.categoryScores, 'key', categoryId, delta);

    for (const [field, collection] of [
      ['marketId', 'marketScores'],
      ['sellerId', 'sellerScores'],
      ['productId', 'productScores'],
    ] as const) {
      const value = String(data?.[field] || '').trim();
      if (Types.ObjectId.isValid(value)) {
        nextProfile[collection] = upsertSignal(nextProfile[collection], 'refId', value, delta);
      }
    }

    const productId = String(data?.productId || '').trim();
    if (Types.ObjectId.isValid(productId)) {
      nextProfile.recentProductIds = [
        new Types.ObjectId(productId),
        ...nextProfile.recentProductIds.filter((id: any) => String(id) !== productId),
      ].slice(0, 60);
    }

    await this.userModel.findByIdAndUpdate(userId, { $set: { recommendationProfile: nextProfile } }).exec();
    return {
      recorded: true,
      action,
      weight: delta,
      categoryId: categoryId || null,
    };
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
      const secret = process.env.INTERNAL_SERVICE_SECRET;
      const headers = secret ? { 'x-internal-service-key': secret } : {};
      await axios.post(`${notificationUrl}/notifications/email`, {
        userId,
        email: user.email,
        type: 'email.verification',
        params: { code, fullName: user.fullName, expiresInMinutes: 15 }
      }, { headers });
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
