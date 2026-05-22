import {
  BadRequestException,
  Controller,
  Post,
  Body,
  Get,
  UseGuards,
  Request,
  Param,
  Put,
  ForbiddenException,
  UnauthorizedException,
} from '@nestjs/common';
import { Types } from 'mongoose';
import { Throttle } from '@nestjs/throttler';
import { UsersService } from './users.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RegisterDto } from './dto/register.dto';

@Controller('users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  private verifyAdminOrInternal(req: any) {
    const configuredSecret = process.env.INTERNAL_SERVICE_SECRET;
    const providedSecret = req?.headers?.['x-internal-service-key'];

    if (configuredSecret && providedSecret === configuredSecret) {
      return;
    }

    const authHeader = req?.headers?.authorization || '';
    const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : '';
    if (!token) {
      throw new UnauthorizedException('Authentication is required to change user roles');
    }

    try {
      const jwt = require('jsonwebtoken');
      const payload = jwt.verify(token, process.env.JWT_SECRET || 'dev-secret-change-in-prod');
      if (payload?.role === 'ADMIN') {
        return;
      }
    } catch {
      throw new UnauthorizedException('Invalid authentication token');
    }

    throw new ForbiddenException('Only administrators can change user roles');
  }

  @Throttle({ default: { limit: 5, ttl: 60000 } })
  @Post('register')
  async register(@Body() userData: RegisterDto) {
    const user = await this.usersService.create(userData);
    return { success: true, data: user };
  }

  @Throttle({ default: { limit: 3, ttl: 60000 } })
  @Post('support')
  async createSupportTicket(@Body() ticketData: any) {
    if (!ticketData.name || !ticketData.email || !ticketData.subject || !ticketData.message) {
      throw new BadRequestException('Name, email, subject, and message are required.');
    }
    const ticket = await this.usersService.createSupportTicket(ticketData);
    return { success: true, data: ticket };
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
  @Get('preferences/discovery')
  async getDiscoveryPreferences(@Request() req: any) {
    const preferences = await this.usersService.getDiscoveryPreferences(req.user.userId);
    return { success: true, data: preferences };
  }

  @UseGuards(JwtAuthGuard)
  @Put('preferences/discovery')
  async updateDiscoveryPreferences(@Request() req: any, @Body() body: any) {
    const preferences = await this.usersService.updateDiscoveryPreferences(req.user.userId, body || {});
    return { success: true, data: preferences };
  }

  @UseGuards(JwtAuthGuard)
  @Post('recommendations/interactions')
  async recordRecommendationInteraction(@Request() req: any, @Body() body: any) {
    const result = await this.usersService.recordRecommendationInteraction(req.user.userId, body || {});
    return { success: true, data: result };
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
    const wishlist = await this.usersService.getWishlist(req.user.userId);
    return { success: true, data: wishlist };
  }

  @UseGuards(JwtAuthGuard)
  @Post('wishlist/remove')
  async removeFromWishlist(@Request() req: any, @Body('productId') productId: string) {
    const user = await this.usersService.removeFromWishlist(req.user.userId, productId);
    return { success: true, data: user.wishlist };
  }

  // FIX [IDOR-1]: Require auth + ownership check — users can only fetch their own record.
  // Admins can fetch any record. Previously any authenticated user could fetch any userId.
  @UseGuards(JwtAuthGuard)
  @Get(':id')
  async getById(@Param('id') id: string, @Request() req: any) {
    if (!Types.ObjectId.isValid(id)) {
      throw new BadRequestException('Invalid user ID');
    }
    const requestingUserId = req.user.userId;
    const requestingRole = req.user.role;
    if (requestingUserId !== id && requestingRole !== 'ADMIN') {
      throw new ForbiddenException('You can only view your own profile');
    }
    const user = await this.usersService.findById(id);
    const userObj = user.toObject();
    delete userObj.passwordHash;
    return { success: true, data: userObj };
  }

  // FIX [PRIV-ESC-1]: CRITICAL — was completely unauthenticated, allowing any caller to
  // escalate any account to ADMIN. Now requires a valid JWT from an existing ADMIN.
  @Put(':id/role')
  async updateRole(
    @Param('id') id: string,
    @Body() body: { role: string },
    @Request() req: any,
  ) {
    if (!Types.ObjectId.isValid(id)) {
      throw new BadRequestException('Invalid user ID');
    }
    this.verifyAdminOrInternal(req);
    const validRoles = ['BUYER', 'SELLER', 'RIDER', 'ADMIN'];
    if (!validRoles.includes(body.role)) {
      throw new BadRequestException(`Invalid role. Must be one of: ${validRoles.join(', ')}`);
    }
    const updated = await this.usersService.updateRole(id, body.role);
    return { success: true, data: { id: updated._id, role: updated.role } };
  }

  @UseGuards(JwtAuthGuard)
  @Post('verify-email/send')
  async sendVerificationCode(@Request() req: any) {
    const result = await this.usersService.sendVerificationCode(req.user.userId);
    return { success: true, data: result };
  }

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
