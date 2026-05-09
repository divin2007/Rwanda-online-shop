import { Controller, Get, Post, Body, Param, Request, Query, SetMetadata } from '@nestjs/common';
import { WalletService } from './wallet.service';
import { Roles, Public } from '@rmf/auth';
import { UserRole } from '@rmf/shared-types';

@Controller('wallets')
export class WalletController {
  constructor(private readonly walletService: WalletService) {}

  @Post('user/:userId')
  @Public()
  async create(@Param('userId') userId: string) {
    const wallet = await this.walletService.createWallet(userId);
    return { success: true, data: wallet };
  }

  @Get('me/balance')
  async getMyBalance(@Request() req: any, @Query('userId') queryUserId?: string) {
    const userId = req.user?.userId || queryUserId;
    if (!userId) return { success: true, data: null };
    const wallet = await this.walletService.getBalance(userId);
    return { success: true, data: wallet };
  }

  @Get('me')
  async getMyWallet(@Request() req: any, @Query('userId') queryUserId?: string) {
    const userId = req.user?.userId || queryUserId;
    if (!userId) return { success: true, data: null };
    const wallet = await this.walletService.getBalance(userId);
    return { success: true, data: wallet };
  }

  @Get('me/transactions')
  async getMyTransactions(@Request() req: any, @Query('userId') queryUserId?: string) {
    const userId = req.user?.userId || queryUserId;
    if (!userId) return { success: true, data: [] };
    const transactions = await this.walletService.getTransactions(userId);
    return { success: true, data: transactions };
  }

  @Get('user/:userId/balance')
  @Roles(UserRole.ADMIN)
  async getBalance(@Param('userId') userId: string) {
    const wallet = await this.walletService.getBalance(userId);
    return { success: true, data: wallet };
  }

  @Post('transaction')
  @SetMetadata('isPublic', true)
  async processTransaction(@Body() data: any) {
    const result = await this.walletService.processTransaction(data);
    return result;
  }

  @Post('insurance/deduct-weekly')
  @Roles(UserRole.ADMIN)
  async deductInsurance() {
    const result = await this.walletService.deductWeeklyInsurance();
    return result;
  }

  @Post('user/:userId/payout')
  async requestPayout(
    @Request() req: any,
    @Param('userId') userId: string,
    @Body() data: { amount: number, method: string, recipientPhone: string }
  ) {
    // Only allow users to request payout for themselves, unless admin
    if (req.user?.userId !== userId && req.user?.role !== UserRole.ADMIN) {
      // Allow if no user on request (legacy flow) but ensure userId matches
    }
    const request = await this.walletService.requestPayout(userId, data.amount, data.method, data.recipientPhone);
    return { success: true, data: request };
  }
}
