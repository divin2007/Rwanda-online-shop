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

    const newUser = new this.userModel({
      ...userData,
      passwordHash,
      role: userData.role || UserRole.BUYER,
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
}
