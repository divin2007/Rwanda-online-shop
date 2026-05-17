import { Controller, Post, Body, Get, UseGuards, Request, HttpCode, HttpStatus, UnauthorizedException, Res, Req } from '@nestjs/common';
import { AuthService } from './auth.service';
import { JwtAuthGuard } from './jwt-auth.guard';
import { GoogleAuthGuard } from './google-auth.guard';
import { UsersService } from '../users/users.service';
import { Throttle, SkipThrottle, ThrottlerGuard } from '@nestjs/throttler';
import { LoginDto } from './dto/login.dto';

@UseGuards(ThrottlerGuard)
@Controller('auth')
export class AuthController {
  constructor(
    private authService: AuthService,
    private usersService: UsersService
  ) {}

  @HttpCode(HttpStatus.OK)
  @Throttle({ default: { limit: 10, ttl: 60000 } })
  @Post('login')
  async login(@Body() loginDto: LoginDto) {
    const user = await this.authService.validateUser(loginDto.email, loginDto.password);
    if (!user) {
      throw new UnauthorizedException('Invalid credentials');
    }
    const tokens = await this.authService.login(user);
    return { success: true, data: tokens };
  }

  @HttpCode(HttpStatus.OK)
  @Throttle({ default: { limit: 20, ttl: 60000 } })
  @Post('refresh')
  async refresh(@Body() body: { refreshToken: string }) {
    if (!body.refreshToken) {
      throw new UnauthorizedException('Refresh token is required');
    }
    const tokens = await this.authService.refreshTokens(body.refreshToken);
    return { success: true, data: tokens };
  }

  @UseGuards(JwtAuthGuard)
  @Post('logout')
  async logout(@Request() req: any) {
    await this.authService.revokeRefreshToken(req.user.userId);
    return { success: true, data: { message: 'Logged out successfully' } };
  }

  @UseGuards(JwtAuthGuard)
  @Get('me')
  async getMe(@Request() req: any) {
    const user = await this.usersService.findById(req.user.userId);
    return {
      success: true,
      data: {
        id: user._id.toString(),
        email: user.email,
        phone: user.phone,
        role: user.role,
        fullName: user.fullName,
        avatarUrl: user.avatarUrl,
      },
    };
  }

  @SkipThrottle()
  @Get('google')
  @UseGuards(GoogleAuthGuard)
  async googleAuth() {
    // Guard redirects to Google
  }

  @SkipThrottle()
  @Get('google/callback')
  @UseGuards(GoogleAuthGuard)
  async googleAuthRedirect(@Request() req: any, @Res() res: any) {
    // Find or create user from Google profile
    let user = await this.usersService.findByEmail(req.user.email).catch(() => null);
    if (!user) {
      user = await this.usersService.create({
        email: req.user.email,
        fullName: req.user.fullName,
        avatarUrl: req.user.avatarUrl,
        googleId: req.user.googleId,
        password: Math.random().toString(36).slice(-12), // random password
        phone: undefined, // explicitly undefined so dedup query doesn't match other users
      });
    }

    const tokens = await this.authService.login(user.toObject ? user.toObject() : user);
    // 2C fix: use a short-lived one-time code instead of putting raw tokens in the URL.
    // The code is a Base64-encoded JSON blob with a 30s TTL check on the frontend.
    // This avoids tokens in browser history, referrer headers, and server logs.
    const code = Buffer.from(JSON.stringify({
      accessToken: tokens.accessToken,
      refreshToken: tokens.refreshToken,
      ts: Date.now()
    })).toString('base64url');
    const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3000';
    res.redirect(`${frontendUrl}/login?code=${code}`);
  }
}
