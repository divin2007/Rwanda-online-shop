import { Controller, Get, Query, Param, Patch, Body, Req, UseGuards, ForbiddenException } from '@nestjs/common';
import { AdminService } from './admin.service';
import { Roles, JwtAuthGuard } from '@rmf/auth';
import { UserRole } from '@rmf/shared-types';

@Controller()
export class AdminController {
  constructor(private readonly adminService: AdminService) {}

  // FIX [ADMIN-SUMMARY]: Was unauthenticated — platform financial summary was public.
  // Now requires ADMIN role.
  @UseGuards(JwtAuthGuard)
  @Roles(UserRole.ADMIN)
  @Get('analytics/summary')
  async getSummaryAnalytics() {
    const stats = await this.adminService.getSummaryAnalytics();
    return { success: true, data: stats };
  }

  @Get('admin/approvals')
  @Roles(UserRole.ADMIN)
  async getPendingApprovals() {
    const approvals = await this.adminService.getPendingApprovals();
    return { success: true, data: approvals };
  }

  @Get('admin/disputes')
  @Roles(UserRole.ADMIN)
  async getDisputes(@Query('status') status?: 'active' | 'resolved') {
    const disputes = await this.adminService.getDisputes(status);
    return { success: true, data: disputes };
  }

  @Get('admin/analytics')
  @Roles(UserRole.ADMIN)
  async getSystemAnalytics() {
    const analytics = await this.adminService.getSystemAnalytics();
    return { success: true, data: analytics };
  }

  @Get('admin/operations')
  @Roles(UserRole.ADMIN)
  async getOperationsOverview() {
    const overview = await this.adminService.getOperationsOverview();
    return { success: true, data: overview };
  }

  @Get('analytics/seller/:id')
  @Roles(UserRole.ADMIN, UserRole.SELLER)
  async getSellerAnalytics(@Param('id') id: string, @Req() req: any) {
    if (req.user.role === UserRole.SELLER && req.user.userId !== id) {
      throw new ForbiddenException('Sellers can only view their own analytics');
    }
    const analytics = await this.adminService.getSellerAnalytics(id);
    return { success: true, data: analytics };
  }

  @Get('admin/accounting/summary')
  @Roles(UserRole.ADMIN)
  async getAccountingSummary(@Query('startDate') startDate?: string, @Query('endDate') endDate?: string) {
    const summary = await this.adminService.getAccountingSummary(startDate, endDate);
    return { success: true, data: summary };
  }

  @Get('admin/accounting/by-seller')
  @Roles(UserRole.ADMIN)
  async getAccountingBySeller(@Query('startDate') startDate?: string, @Query('endDate') endDate?: string) {
    const data = await this.adminService.getAccountingBySeller(startDate, endDate);
    return { success: true, data };
  }

  @Get('admin/fraud-alerts')
  @Roles(UserRole.ADMIN)
  async getFraudAlerts() {
    const alerts = await this.adminService.getFraudAlerts();
    return { success: true, data: alerts };
  }

  @Get('admin/dashboard/analytics')
  @Roles(UserRole.ADMIN)
  async getAdminDashboardAnalytics() {
    const analytics = await this.adminService.getAnalyticsDashboard();
    return { success: true, data: analytics };
  }

  @Get('seller/dashboard/analytics/:id')
  @Roles(UserRole.ADMIN, UserRole.SELLER)
  async getSellerDashboardAnalytics(@Param('id') id: string, @Req() req: any) {
    if (req.user.role === UserRole.SELLER && req.user.userId !== id) {
      throw new ForbiddenException('Sellers can only view their own dashboard analytics');
    }
    const analytics = await this.adminService.getAnalyticsDashboard(id);
    return { success: true, data: analytics };
  }

  @Get('admin/support')
  @Roles(UserRole.ADMIN)
  async getSupportTickets() {
    const tickets = await this.adminService.getSupportTickets();
    return { success: true, data: tickets };
  }

  @Patch('admin/support/:id')
  @Roles(UserRole.ADMIN)
  async updateSupportTicket(
    @Param('id') id: string,
    @Body('status') status: string,
    @Req() req: any,
  ) {
    const adminId = req.user?.userId;
    const ticket = await this.adminService.updateSupportTicketStatus(id, status, adminId);
    return { success: true, data: ticket };
  }
}
