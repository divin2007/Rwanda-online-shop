import { Controller, Post, Body, Get, UseGuards, Request } from '@nestjs/common';
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
}
