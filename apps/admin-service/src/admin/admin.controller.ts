import { Controller, Get, Query, Param } from '@nestjs/common';
import { AdminService } from './admin.service';

@Controller()
export class AdminController {
  constructor(private readonly adminService: AdminService) {}

  @Get('admin/approvals')
  async getPendingApprovals() {
    const approvals = await this.adminService.getPendingApprovals();
    return { success: true, data: approvals };
  }

  @Get('admin/disputes')
  async getDisputes(@Query('status') status?: 'active' | 'resolved') {
    const disputes = await this.adminService.getDisputes(status);
    return { success: true, data: disputes };
  }

  @Get('admin/analytics')
  async getSystemAnalytics() {
    const analytics = await this.adminService.getSystemAnalytics();
    return { success: true, data: analytics };
  }

  @Get('analytics/seller/:id')
  async getSellerAnalytics(@Param('id') id: string) {
    const analytics = await this.adminService.getSellerAnalytics(id);
    return { success: true, data: analytics };
  }

  @Get('admin/fraud-alerts')
  async getFraudAlerts() {
    const alerts = await this.adminService.getFraudAlerts();
    return { success: true, data: alerts };
  }
}
