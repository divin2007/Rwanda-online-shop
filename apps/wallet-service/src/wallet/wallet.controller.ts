import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Request,
  Query,
  SetMetadata,
  UseGuards,
  ForbiddenException,
  UnauthorizedException,
} from '@nestjs/common';
import { WalletService } from './wallet.service';
import { Roles, Public, JwtAuthGuard } from '@rmf/auth';
import { UserRole } from '@rmf/shared-types';

/**
 * Verify internal microservice calls via shared secret header.
 * Used for wallet creation triggered by user-service during registration,
 * and transaction processing triggered by order-service.
 */
function verifyInternalSecret(req: any): void {
  const secret = process.env.INTERNAL_SERVICE_SECRET;
  if (!secret) return; // Dev mode — skip check
  const provided = req.headers?.['x-internal-service-key'];
  if (provided !== secret) {
    throw new UnauthorizedException('Invalid internal service key');
  }
}

@Controller('wallets')
export class WalletController {
  constructor(private readonly walletService: WalletService) {}

  // FIX [WALLET-CREATE]: Was @Public() — anyone could create wallets for arbitrary userIds.
  // Now gated by internal service secret (called by user-service on registration).
  @Public()
  @Post('user/:userId')
  async create(@Param('userId') userId: string, @Request() req: any) {
    verifyInternalSecret(req);
    const wallet = await this.walletService.createWallet(userId);
    return { success: true, data: wallet };
  }

  // FIX [WALLET-ME]: Removed queryUserId fallback — IDOR bypass.
  @UseGuards(JwtAuthGuard)
  @Get('me/balance')
  async getMyBalance(@Request() req: any) {
    const userId = req.user?.userId;
    if (!userId) return { success: true, data: null };
    const wallet = await this.walletService.getBalance(userId);
    return { success: true, data: wallet };
  }

  @UseGuards(JwtAuthGuard)
  @Get('me')
  async getMyWallet(@Request() req: any) {
    const userId = req.user?.userId;
    if (!userId) return { success: true, data: null };
    const wallet = await this.walletService.getBalance(userId);
    return { success: true, data: wallet };
  }

  // FIX [WALLET-TX-HISTORY]: Removed queryUserId fallback — IDOR bypass.
  @UseGuards(JwtAuthGuard)
  @Get('me/transactions')
  async getMyTransactions(@Request() req: any) {
    const userId = req.user?.userId;
    if (!userId) return { success: true, data: [] };
    const transactions = await this.walletService.getTransactions(userId);
    return { success: true, data: transactions };
  }

  @UseGuards(JwtAuthGuard)
  @Get('user/:userId/balance')
  @Roles(UserRole.ADMIN)
  async getBalance(@Param('userId') userId: string) {
    const wallet = await this.walletService.getBalance(userId);
    return { success: true, data: wallet };
  }

  // FIX [WALLET-DEPOSIT]: Was unauthenticated — anyone could deposit to any account.
  // Now requires auth + ownership check (only deposit to your own wallet).
  @UseGuards(JwtAuthGuard)
  @Post(':userId/deposit')
  async deposit(
    @Param('userId') userId: string,
    @Body() data: { amount: number; method?: string; phone?: string },
    @Request() req: any,
  ) {
    if (req.user?.userId !== userId && req.user?.role !== UserRole.ADMIN) {
      throw new ForbiddenException('You can only deposit to your own wallet');
    }
    const wallet = await this.walletService.deposit(userId, Number(data.amount), data.method || 'momo', data.phone);
    return { success: true, data: wallet };
  }

  // FIX [WALLET-PAYOUT-LEGACY]: Was unauthenticated — anyone could request payouts
  // from any user's wallet. Now requires auth + ownership verification.
  @UseGuards(JwtAuthGuard)
  @Post('payout-request')
  async requestPayoutLegacy(
    @Body() data: { amount: number; method?: string; recipientPhone?: string; momoNumber?: string },
    @Request() req: any,
  ) {
    const userId = req.user?.userId;
    if (!userId) throw new UnauthorizedException('Authentication required');

    const recipientPhone = data.recipientPhone || data.momoNumber;
    if (!recipientPhone) {
      return { success: false, message: 'Recipient phone is required' };
    }

    const request = await this.walletService.requestPayout(
      userId,
      Number(data.amount),
      data.method || 'momo',
      recipientPhone,
    );
    return { success: true, data: request };
  }

  // FIX [WALLET-TX]: Was isPublic — anyone could process arbitrary financial transactions.
  // Now gated by internal service secret (called by order-service).
  @Public()
  @Post('transaction')
  async processTransaction(@Body() data: any, @Request() req: any) {
    verifyInternalSecret(req);
    const result = await this.walletService.processTransaction(data);
    return result;
  }

  @UseGuards(JwtAuthGuard)
  @Post('insurance/deduct-weekly')
  @Roles(UserRole.ADMIN)
  async deductInsurance() {
    const result = await this.walletService.deductWeeklyInsurance();
    return result;
  }

  // FIX [WALLET-PAYOUT-2]: Added actual ownership enforcement.
  @UseGuards(JwtAuthGuard)
  @Post('user/:userId/payout')
  async requestPayout(
    @Request() req: any,
    @Param('userId') userId: string,
    @Body() data: { amount: number; method: string; recipientPhone: string },
  ) {
    if (req.user?.userId !== userId && req.user?.role !== UserRole.ADMIN) {
      throw new ForbiddenException('You can only request payouts from your own wallet');
    }
    const request = await this.walletService.requestPayout(userId, data.amount, data.method, data.recipientPhone);
    return { success: true, data: request };
  }

  @Post('payout/:payoutId/complete')
  @Roles(UserRole.ADMIN)
  async completePayout(@Param('payoutId') payoutId: string) {
    const result = await this.walletService.completePayout(payoutId);
    return { success: true, data: result };
  }

  @Post('payout/:payoutId/fail')
  @Roles(UserRole.ADMIN)
  async failPayout(@Param('payoutId') payoutId: string, @Body() data: { reason: string }) {
    const result = await this.walletService.failPayout(payoutId, data.reason || 'Admin rejected payout');
    return { success: true, data: result };
  }

  // FIX [WALLET-PAYOUTS-LIST]: Was @Public() — exposed all payout requests (amounts, phones)
  // to the entire internet. Now ADMIN only.
  @Roles(UserRole.ADMIN)
  @Get('payouts/all')
  async getAllPayoutRequests() {
    const payouts = await this.walletService.getAllPayoutRequests();
    return { success: true, data: payouts };
  }
}
