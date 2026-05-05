import { Controller, Get, Query, Param } from '@nestjs/common';
import { AdminService } from './admin.service';
import { Roles } from '@rmf/auth';
import { UserRole } from '@rmf/shared-types';

@Controller()
export class AdminController {
  constructor(private readonly adminService: AdminService) {}

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

  @Get('analytics/seller/:id')
  @Roles(UserRole.ADMIN)
  async getSellerAnalytics(@Param('id') id: string) {
    const analytics = await this.adminService.getSellerAnalytics(id);
    return { success: true, data: analytics };
  }

  @Get('admin/fraud-alerts')
  @Roles(UserRole.ADMIN)
  async getFraudAlerts() {
    const alerts = await this.adminService.getFraudAlerts();
    return { success: true, data: alerts };
  }
}
