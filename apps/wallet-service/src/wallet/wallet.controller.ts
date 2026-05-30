import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Request,
  Query,
  UseGuards,
  ForbiddenException,
  UnauthorizedException,
  BadRequestException,
} from '@nestjs/common';
import { WalletService } from './wallet.service';
import { Roles, Public, JwtAuthGuard } from '@rmf/auth';
import { UserRole } from '@rmf/shared-types';

function verifyInternalSecret(req: any): void {
  const secret = process.env.INTERNAL_SERVICE_SECRET;
  if (!secret) {
    throw new UnauthorizedException('INTERNAL_SERVICE_SECRET must be configured');
  }
  if (req.headers?.['x-internal-service-key'] !== secret) {
    throw new UnauthorizedException('Invalid internal service key');
  }
}

@Controller('wallets')
export class WalletController {
  constructor(private readonly walletService: WalletService) {}

  // ─── GET /wallets/me/balance ───────────────────────────────────────────────
  @UseGuards(JwtAuthGuard)
  @Get('me/balance')
  async getMyBalance(@Request() req: any) {
    const userId = req.user?.userId;
    if (!userId) return { success: true, data: null };
    const wallet = await this.walletService.getBalance(userId);
    return { success: true, data: wallet };
  }

  // ─── GET /wallets/me ──────────────────────────────────────────────────────
  @UseGuards(JwtAuthGuard)
  @Get('me')
  async getMyWallet(@Request() req: any) {
    const userId = req.user?.userId;
    if (!userId) return { success: true, data: null };
    const wallet = await this.walletService.getBalance(userId);
    return { success: true, data: wallet };
  }

  // ─── GET /wallets/me/transactions ─────────────────────────────────────────
  @UseGuards(JwtAuthGuard)
  @Get('me/transactions')
  async getMyTransactions(
    @Request() req: any,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    const userId = req.user?.userId;
    if (!userId) return { success: true, data: [] };
    const result = await this.walletService.getTransactions(
      userId,
      Number(page) || 1,
      Number(limit) || 20,
    );
    return { success: true, data: result };
  }

  // ─── POST /wallets/withdraw ────────────────────────────────────────────────
  // Only SELLER and RIDER can withdraw. Minimum 500 RWF.
  @UseGuards(JwtAuthGuard)
  @Post('withdraw')
  async withdraw(
    @Request() req: any,
    @Body() body: { amount: number; momo_number: string },
  ) {
    const userId = req.user?.userId;
    const role   = req.user?.role;

    if (!userId) throw new UnauthorizedException('Authentication required');
    if (!['SELLER', 'RIDER'].includes(String(role || '').toUpperCase())) {
      throw new ForbiddenException('Only sellers and riders can make withdrawals');
    }
    if (!body.amount || !body.momo_number) {
      throw new BadRequestException('amount and momo_number are required');
    }

    const result = await this.walletService.requestWithdrawal(
      userId,
      role,
      body.amount,
      body.momo_number,
    );
    return { success: true, data: result };
  }

  // ─── INTERNAL: POST /wallets/internal/credit ──────────────────────────────
  // Called by order-service after delivery confirmation to credit wallets.
  @Public()
  @Post('internal/credit')
  async internalCredit(@Body() data: any, @Request() req: any) {
    verifyInternalSecret(req);
    await this.walletService.creditWallet({
      userId:      data.userId,
      role:        data.role,
      amount:      data.amount,
      orderId:     data.orderId,
      orderNumber: data.orderNumber,
      description: data.description,
    });
    return { success: true };
  }

  // ─── ADMIN: GET /wallets/user/:userId/balance ──────────────────────────────
  @UseGuards(JwtAuthGuard)
  @Roles(UserRole.ADMIN)
  @Get('user/:userId/balance')
  async getBalance(@Param('userId') userId: string) {
    const wallet = await this.walletService.getBalance(userId);
    return { success: true, data: wallet };
  }

  // ─── ADMIN: GET /wallets/payouts/all ──────────────────────────────────────
  @UseGuards(JwtAuthGuard)
  @Roles(UserRole.ADMIN)
  @Get('payouts/all')
  async getAllPayoutRequests() {
    const payouts = await this.walletService.getAllPayoutRequests();
    return { success: true, data: payouts };
  }

  // ─── LEGACY: POST /wallets/user/:userId/payout ────────────────────────────
  @UseGuards(JwtAuthGuard)
  @Post('user/:userId/payout')
  async requestPayoutLegacy(
    @Request() req: any,
    @Param('userId') userId: string,
    @Body() data: { amount: number; method?: string; recipientPhone?: string; momoNumber?: string },
  ) {
    if (req.user?.userId !== userId && req.user?.role !== UserRole.ADMIN) {
      throw new ForbiddenException('You can only request payouts from your own wallet');
    }
    const phone = data.recipientPhone || data.momoNumber;
    if (!phone) throw new BadRequestException('Recipient phone is required');
    const result = await this.walletService.requestPayout(userId, data.amount, data.method || 'momo', phone);
    return { success: true, data: result };
  }

  // ─── INTERNAL: POST /wallets/transaction (legacy order-service calls) ──────
  @Public()
  @Post('transaction')
  async processTransaction(@Body() data: any, @Request() req: any) {
    verifyInternalSecret(req);
    const result = await this.walletService.processTransaction(data);
    return result;
  }

  // ─── INTERNAL: POST /wallets/user/:userId (create wallet on registration) ──
  @Public()
  @Post('user/:userId')
  async create(@Param('userId') userId: string, @Request() req: any) {
    verifyInternalSecret(req);
    const wallet = await this.walletService.createWallet(userId);
    return { success: true, data: wallet };
  }
}
