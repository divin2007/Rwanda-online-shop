import { Controller, Get, Query } from '@nestjs/common';
import { AdminService } from './admin.service';

@Controller('admin')
export class AdminController {
  constructor(private readonly adminService: AdminService) {}

  @Get('approvals')
  async getPendingApprovals() {
    const approvals = await this.adminService.getPendingApprovals();
    return { success: true, data: approvals };
  }

  @Get('disputes')
  async getDisputes(@Query('status') status?: 'active' | 'resolved') {
    const disputes = await this.adminService.getDisputes(status);
    return { success: true, data: disputes };
  }

  @Get('analytics')
  async getSystemAnalytics() {
    const analytics = await this.adminService.getSystemAnalytics();
    return { success: true, data: analytics };
  }

  @Get('fraud-alerts')
  async getFraudAlerts() {
    const alerts = await this.adminService.getFraudAlerts();
    return { success: true, data: alerts };
  }
}
