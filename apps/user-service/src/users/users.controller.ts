import { BadRequestException, Controller, Post, Body, Get, UseGuards, Request, Param, Put } from '@nestjs/common';
import { Types } from 'mongoose';
import { Throttle } from '@nestjs/throttler';
import { UsersService } from './users.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RegisterDto } from './dto/register.dto';

@Controller('users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Throttle({ default: { limit: 5, ttl: 60000 } })
  @Post('register')
  async register(@Body() userData: RegisterDto) {
    const user = await this.usersService.create(userData);
    return { success: true, data: user };
  }

  @UseGuards(JwtAuthGuard)
  @Get('profile')
  async getProfile(@Request() req: any) {
    const user = await this.usersService.findById(req.user.userId);
    const userObj = user.toObject();
    delete userObj.passwordHash;
    return { success: true, data: userObj };
  }

  @UseGuards(JwtAuthGuard)
  @Get('settings')
  async getSettings(@Request() req: any) {
    const settings = await this.usersService.getSettings(req.user.userId);
    return { success: true, data: settings };
  }

  @UseGuards(JwtAuthGuard)
  @Put('settings')
  async updateSettings(@Request() req: any) {
    const settings = await this.usersService.updateSettings(req.user.userId, req.body || {});
    return { success: true, data: settings };
  }

  @UseGuards(JwtAuthGuard)
  @Post('wishlist')
  async addToWishlist(@Request() req: any, @Body('productId') productId: string) {
    const user = await this.usersService.addToWishlist(req.user.userId, productId);
    return { success: true, data: user.wishlist };
  }

  @UseGuards(JwtAuthGuard)
  @Get('wishlist')
  async getWishlist(@Request() req: any) {
    console.log(`[UsersController] Fetching wishlist for userId: ${req.user?.userId}`);
    const wishlist = await this.usersService.getWishlist(req.user.userId);
    return { success: true, data: wishlist };
  }

  @UseGuards(JwtAuthGuard)
  @Post('wishlist/remove')
  async removeFromWishlist(@Request() req: any, @Body('productId') productId: string) {
    const user = await this.usersService.removeFromWishlist(req.user.userId, productId);
    return { success: true, data: user.wishlist };
  }

  @UseGuards(JwtAuthGuard)
  @Get(':id')
  async getById(@Param('id') id: string) {
    if (!Types.ObjectId.isValid(id)) {
      throw new BadRequestException('Invalid user ID');
    }
    const user = await this.usersService.findById(id);
    const userObj = user.toObject();
    delete userObj.passwordHash;
    return { success: true, data: userObj };
  }

  // 3F fix: called by seller-service and rider-service after admin approval
  // to sync the user's role in the JWT source of truth
  @Put(':id/role')
  async updateRole(@Param('id') id: string, @Body() body: { role: string }) {
    if (!Types.ObjectId.isValid(id)) {
      throw new BadRequestException('Invalid user ID');
    }
    const validRoles = ['BUYER', 'SELLER', 'RIDER', 'ADMIN'];
    if (!validRoles.includes(body.role)) {
      throw new BadRequestException(`Invalid role. Must be one of: ${validRoles.join(', ')}`);
    }
    const updated = await this.usersService.updateRole(id, body.role);
    return { success: true, data: { id: updated._id, role: updated.role } };
  }

  // 1A fix: send email verification code
  @UseGuards(JwtAuthGuard)
  @Post('verify-email/send')
  async sendVerificationCode(@Request() req: any) {
    const result = await this.usersService.sendVerificationCode(req.user.userId);
    return { success: true, data: result };
  }

  // 1A fix: verify email with code
  @UseGuards(JwtAuthGuard)
  @Post('verify-email/confirm')
  async verifyEmail(@Request() req: any, @Body() body: { code: string }) {
    if (!body.code || body.code.length !== 6) {
      throw new BadRequestException('Invalid verification code format. Must be 6 digits.');
    }
    const result = await this.usersService.verifyEmail(req.user.userId, body.code);
    return { success: true, data: result };
  }
}
