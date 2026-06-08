import { Controller, Get, Post, Body, Request, UseGuards } from '@nestjs/common';
import { B2bService } from './b2b.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';

@Controller('b2b')
export class B2bController {
  constructor(private readonly b2bService: B2bService) {}

  @UseGuards(JwtAuthGuard)
  @Post('accounts')
  async create(@Request() req: any, @Body() body: any) {
    const data = await this.b2bService.create(req.user.userId, body);
    return { success: true, data };
  }

  @UseGuards(JwtAuthGuard)
  @Get('accounts/me')
  async getMine(@Request() req: any) {
    const data = await this.b2bService.getMine(req.user.userId);
    return { success: true, data };
  }
}
