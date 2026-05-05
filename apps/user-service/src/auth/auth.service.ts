import { Injectable, UnauthorizedException, Inject, forwardRef } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { UsersService } from '../users/users.service';
import * as bcrypt from 'bcrypt';
import * as crypto from 'crypto';

@Injectable()
export class AuthService {
  constructor(
    private usersService: UsersService,
    private jwtService: JwtService,
    @InjectModel('User') private userModel: Model<any>
  ) {}

  async validateUser(email: string, pass: string): Promise<any> {
    const user = await this.usersService.findByEmail(email);

    if (!user) {
      throw new UnauthorizedException('Invalid credentials');
    }

    if (user.security?.lockedUntil && user.security.lockedUntil > new Date()) {
      throw new UnauthorizedException('Account locked due to multiple failed login attempts');
    }

    const isMatch = await bcrypt.compare(pass, user.passwordHash);

    if (isMatch) {
      await this.usersService.updateLoginAttempts(email, true);
      const { passwordHash, ...result } = user.toObject();
      return result;
    }

    await this.usersService.updateLoginAttempts(email, false);
    throw new UnauthorizedException('Invalid credentials');
  }

  private generateRefreshTokenHash(token: string): string {
    return crypto.createHash('sha256').update(token).digest('hex');
  }

  async login(user: any) {
    const payload = { email: user.email, sub: user._id.toString(), role: user.role };

    // Generate access token (15 min expiry)
    const accessToken = this.jwtService.sign(payload);

    // Generate refresh token (7 day expiry) and store hash for revocation
    const refreshToken = this.jwtService.sign(payload, { expiresIn: '7d' });
    const refreshTokenHash = this.generateRefreshTokenHash(refreshToken);

    await this.userModel.findByIdAndUpdate(user._id, {
      $set: { 'security.refreshTokenHash': refreshTokenHash }
    });

    return {
      accessToken,
      refreshToken,
      user: {
        id: user._id,
        email: user.email,
        role: user.role,
        fullName: user.fullName
      }
    };
  }

  async refreshTokens(refreshToken: string): Promise<{ accessToken: string; refreshToken: string }> {
    try {
      // Verify the refresh token
      const payload = this.jwtService.verify(refreshToken);
      const user = await this.userModel.findById(payload.sub);

      if (!user) {
        throw new UnauthorizedException('User not found');
      }

      // Validate stored hash matches
      const incomingHash = this.generateRefreshTokenHash(refreshToken);
      if (user.security?.refreshTokenHash !== incomingHash) {
        throw new UnauthorizedException('Refresh token has been revoked');
      }

      // Issue new token pair (rotation)
      const newPayload = { email: user.email, sub: user._id, role: user.role };
      const newAccessToken = this.jwtService.sign(newPayload);
      const newRefreshToken = this.jwtService.sign(newPayload, { expiresIn: '7d' });
      const newHash = this.generateRefreshTokenHash(newRefreshToken);

      await this.userModel.findByIdAndUpdate(user._id, {
        $set: { 'security.refreshTokenHash': newHash }
      });

      return { accessToken: newAccessToken, refreshToken: newRefreshToken };
    } catch (err) {
      if (err instanceof UnauthorizedException) throw err;
      throw new UnauthorizedException('Invalid or expired refresh token');
    }
  }

  async revokeRefreshToken(userId: string): Promise<void> {
    await this.userModel.findByIdAndUpdate(userId, {
      $unset: { 'security.refreshTokenHash': 1 }
    });
  }
}
