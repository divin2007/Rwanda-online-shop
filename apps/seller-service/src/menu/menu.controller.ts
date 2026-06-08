import {
  Controller,
  Get,
  Post,
  Put,
  Patch,
  Delete,
  Body,
  Param,
  Request,
  UseGuards,
  BadRequestException,
} from '@nestjs/common';
import { MenuService } from './menu.service';
import { JwtAuthGuard, Public } from '@rmf/auth';

@Controller('sellers/menu')
export class MenuController {
  constructor(private readonly menuService: MenuService) {}

  private requireUserId(req: any): string {
    const userId = req.user?.userId;
    if (!userId) throw new BadRequestException('Authentication required');
    return userId;
  }

  // ── Public buyer-facing read (no auth) ──
  // NOTE: declared before the authed routes so the literal "public" segment
  // is never shadowed by a guarded dynamic route.
  @Public()
  @Get('public/:sellerId')
  async getPublicMenu(@Param('sellerId') sellerId: string) {
    const menu = await this.menuService.getPublicMenu(sellerId);
    return { success: true, data: menu };
  }

  // ── Authenticated seller read ──
  @UseGuards(JwtAuthGuard)
  @Get('me')
  async getMyMenu(@Request() req: any) {
    const menu = await this.menuService.getMyMenu(this.requireUserId(req));
    return { success: true, data: menu };
  }

  // ── Full menu create/replace ──
  @UseGuards(JwtAuthGuard)
  @Post()
  async upsertMenu(@Request() req: any, @Body() body: any) {
    const menu = await this.menuService.upsertMenu(this.requireUserId(req), body || {});
    return { success: true, data: menu };
  }

  // ── Menu metadata update (availabilityHours, isActive, currency) ──
  @UseGuards(JwtAuthGuard)
  @Patch()
  async updateMenuMeta(@Request() req: any, @Body() body: any) {
    const menu = await this.menuService.updateMenuMeta(this.requireUserId(req), body || {});
    return { success: true, data: menu };
  }

  // ── Sections ──
  @UseGuards(JwtAuthGuard)
  @Post('sections')
  async addSection(@Request() req: any, @Body() body: any) {
    const menu = await this.menuService.addSection(this.requireUserId(req), body || {});
    return { success: true, data: menu };
  }

  @UseGuards(JwtAuthGuard)
  @Put('sections/:sectionId')
  async updateSection(@Request() req: any, @Param('sectionId') sectionId: string, @Body() body: any) {
    const menu = await this.menuService.updateSection(this.requireUserId(req), sectionId, body || {});
    return { success: true, data: menu };
  }

  @UseGuards(JwtAuthGuard)
  @Delete('sections/:sectionId')
  async deleteSection(@Request() req: any, @Param('sectionId') sectionId: string) {
    const menu = await this.menuService.deleteSection(this.requireUserId(req), sectionId);
    return { success: true, data: menu };
  }

  // ── Items ──
  @UseGuards(JwtAuthGuard)
  @Post('sections/:sectionId/items')
  async addItem(@Request() req: any, @Param('sectionId') sectionId: string, @Body() body: any) {
    const menu = await this.menuService.addItem(this.requireUserId(req), sectionId, body || {});
    return { success: true, data: menu };
  }

  @UseGuards(JwtAuthGuard)
  @Put('sections/:sectionId/items/:itemId')
  async updateItem(
    @Request() req: any,
    @Param('sectionId') sectionId: string,
    @Param('itemId') itemId: string,
    @Body() body: any,
  ) {
    const menu = await this.menuService.updateItem(this.requireUserId(req), sectionId, itemId, body || {});
    return { success: true, data: menu };
  }

  @UseGuards(JwtAuthGuard)
  @Delete('sections/:sectionId/items/:itemId')
  async deleteItem(
    @Request() req: any,
    @Param('sectionId') sectionId: string,
    @Param('itemId') itemId: string,
  ) {
    const menu = await this.menuService.deleteItem(this.requireUserId(req), sectionId, itemId);
    return { success: true, data: menu };
  }

  @UseGuards(JwtAuthGuard)
  @Patch('sections/:sectionId/items/:itemId/availability')
  async toggleItemAvailability(
    @Request() req: any,
    @Param('sectionId') sectionId: string,
    @Param('itemId') itemId: string,
  ) {
    const menu = await this.menuService.toggleItemAvailability(this.requireUserId(req), sectionId, itemId);
    return { success: true, data: menu };
  }
}
