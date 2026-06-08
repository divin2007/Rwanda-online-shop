import { Controller, Get, Post, Patch, Delete, Body, Param, Request, UseGuards } from '@nestjs/common';
import { B2bOrdersService } from './b2b-orders.service';
import { JwtAuthGuard } from '@rmf/auth';

@Controller('b2b')
export class B2bOrdersController {
  constructor(private readonly b2bOrdersService: B2bOrdersService) {}

  @UseGuards(JwtAuthGuard)
  @Post('order-templates')
  async createTemplate(@Request() req: any, @Body() body: any) {
    const data = await this.b2bOrdersService.createTemplate(req.user.userId, body);
    return { success: true, data };
  }

  @UseGuards(JwtAuthGuard)
  @Get('order-templates')
  async listTemplates(@Request() req: any) {
    const data = await this.b2bOrdersService.listTemplates(req.user.userId);
    return { success: true, data };
  }

  @UseGuards(JwtAuthGuard)
  @Patch('order-templates/:id')
  async updateTemplate(@Request() req: any, @Param('id') id: string, @Body() body: any) {
    const data = await this.b2bOrdersService.updateTemplate(req.user.userId, id, body);
    return { success: true, data };
  }

  @UseGuards(JwtAuthGuard)
  @Delete('order-templates/:id')
  async deleteTemplate(@Request() req: any, @Param('id') id: string) {
    const data = await this.b2bOrdersService.deleteTemplate(req.user.userId, id);
    return { success: true, data };
  }

  @UseGuards(JwtAuthGuard)
  @Get('invoices')
  async listInvoices(@Request() req: any) {
    const data = await this.b2bOrdersService.listInvoices(req.user.userId);
    return { success: true, data };
  }

  @UseGuards(JwtAuthGuard)
  @Get('invoices/:id')
  async getInvoice(@Request() req: any, @Param('id') id: string) {
    const data = await this.b2bOrdersService.getInvoice(req.user.userId, id);
    return { success: true, data };
  }

  @UseGuards(JwtAuthGuard)
  @Get('invoices/:id/pdf')
  async getInvoicePdf(@Request() req: any, @Param('id') id: string) {
    const data = await this.b2bOrdersService.getInvoicePdf(req.user.userId, id);
    return { success: true, data };
  }
}
