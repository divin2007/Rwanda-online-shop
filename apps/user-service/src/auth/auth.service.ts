import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { UsersService } from '../users/users.service';
import * as bcrypt from 'bcrypt';

@Injectable()
export class AuthService {
  constructor(
    private usersService: UsersService,
    private jwtService: JwtService
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

  async login(user: any) {
    const payload = { email: user.email, sub: user._id, role: user.role };
    
    return {
      accessToken: this.jwtService.sign(payload),
      // In a full implementation, we would generate and store a refresh token here
      refreshToken: 'refresh-token-stub',
      user: {
        id: user._id,
        email: user.email,
        role: user.role,
        fullName: user.fullName
      }
    };
  }
}
