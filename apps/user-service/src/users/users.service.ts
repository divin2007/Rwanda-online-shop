import { Injectable, ConflictException, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import * as bcrypt from 'bcrypt';
import { UserRole } from '@rmf/shared-types';

@Injectable()
export class UsersService {
  constructor(@InjectModel('User') private userModel: Model<any>) {}

  async create(userData: any): Promise<any> {
    const existingUser = await this.userModel.findOne({ 
      $or: [{ email: userData.email }, { phone: userData.phone }] 
    });

    if (existingUser) {
      throw new ConflictException('Email or phone already exists');
    }

    const salt = await bcrypt.genSalt(10);
    const passwordHash = await bcrypt.hash(userData.password, salt);

    // Generate a unique 8-character referral code based on their name + random string
    const codeBase = userData.fullName.substring(0, 3).toUpperCase().replace(/[^A-Z]/g, 'X');
    const randomChars = Math.random().toString(36).substring(2, 7).toUpperCase();
    const referralCode = `${codeBase}-${randomChars}`;

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
    return userObj;
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
    return this.userModel.findByIdAndUpdate(
      userId,
      { $addToSet: { wishlist: productId } },
      { new: true }
    ).exec();
  }

  async removeFromWishlist(userId: string, productId: string): Promise<any> {
    return this.userModel.findByIdAndUpdate(
      userId,
      { $pull: { wishlist: productId } },
      { new: true }
    ).exec();
  }

  async getWishlist(userId: string): Promise<any> {
    if (!userId || userId === 'undefined') {
      console.warn('[UserService] getWishlist called with invalid userId');
      throw new NotFoundException('Invalid user ID');
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
}
