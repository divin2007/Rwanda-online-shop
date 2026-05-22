import {
  BadRequestException,
  Controller,
  Delete,
  Get,
  Post,
  Put,
  Body,
  Param,
  Query,
  UseInterceptors,
  UploadedFile,
  Res,
  UseGuards,
  Request,
  ForbiddenException,
  UnauthorizedException,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { randomUUID } from 'crypto';
import { extname } from 'path';
import { Response } from 'express';
import { ProductService } from './product.service';
import { Roles, JwtAuthGuard, OptionalJwtAuthGuard, Public } from '@rmf/auth';
import { UserRole } from '@rmf/shared-types';
import { StorageService } from '../storage/storage.service';

@Controller('products')
export class ProductController {
  constructor(
    private readonly productService: ProductService,
    private readonly storageService: StorageService,
  ) {}

  private readonly imageExtensions: Record<string, string> = {
    'image/jpeg': '.jpg',
    'image/png': '.png',
    'image/webp': '.webp',
    'image/gif': '.gif',
    'image/avif': '.avif',
  };

  private readonly bulkMimeTypes = new Set([
    'text/csv',
    'application/csv',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  ]);

  private verifyInternalService(req: any) {
    const configuredSecret = process.env.INTERNAL_SERVICE_SECRET;
    const providedSecret = req?.headers?.['x-internal-service-key'];

    if (!configuredSecret) {
      if (process.env.NODE_ENV === 'production') {
        throw new UnauthorizedException('Internal service key is not configured');
      }
      return;
    }

    if (providedSecret !== configuredSecret) {
      throw new UnauthorizedException('Invalid internal service key');
    }
  }

  // FIX [PRODUCT-CREATE]: Was unauthenticated — anyone could create products.
  // Now requires SELLER or ADMIN role.
  @UseGuards(JwtAuthGuard)
  @Roles(UserRole.SELLER, UserRole.ADMIN)
  @Post()
  async create(@Body() productData: any, @Request() req: any) {
    const product = await this.productService.create(
      req.user.role === UserRole.ADMIN
        ? productData
        : { ...productData, sellerId: req.user.userId },
    );
    return { success: true, data: product };
  }

  // Public read — product listings are public marketplace data
  @Public()
  @Get()
  async findAll(@Query() query: any) {
    const products = await this.productService.findAll(query);
    return { success: true, data: products };
  }

  @Public()
  @Get('catalog/categories')
  async getCatalogCategories(@Query('includeInactive') includeInactive?: string) {
    const categories = await this.productService.getCatalogCategories(includeInactive === 'true');
    return { success: true, data: categories };
  }

  @Public()
  @Get('catalog/tree')
  async getCatalogTree() {
    const tree = await this.productService.buildCategoryTree();
    return { success: true, data: tree };
  }

  // FIX [PRODUCT-CAT-UPSERT]: Was unauthenticated — anyone could modify catalog categories.
  @UseGuards(JwtAuthGuard)
  @Roles(UserRole.ADMIN)
  @Post('catalog/categories')
  async upsertCatalogCategory(@Body() categoryData: any) {
    const category = await this.productService.upsertCatalogCategory(categoryData);
    return { success: true, data: category };
  }

  @Public()
  @Get('catalog/categories/:categoryId')
  async getCategorySchema(@Param('categoryId') categoryId: string) {
    const category = await this.productService.getCategorySchema(categoryId);
    return { success: true, data: category };
  }

  // FIX [PRODUCT-CAT-UPDATE]: Was unauthenticated.
  @UseGuards(JwtAuthGuard)
  @Roles(UserRole.ADMIN)
  @Put('catalog/categories/:categoryId')
  async updateCatalogCategory(@Param('categoryId') categoryId: string, @Body() categoryData: any) {
    const category = await this.productService.upsertCatalogCategory({ ...categoryData, id: categoryId });
    return { success: true, data: category };
  }

  // FIX [PRODUCT-CAT-DELETE]: Was unauthenticated.
  @UseGuards(JwtAuthGuard)
  @Roles(UserRole.ADMIN)
  @Delete('catalog/categories/:categoryId')
  async deleteCatalogCategory(@Param('categoryId') categoryId: string, @Body() body: { actorId?: string } = {}) {
    const category = await this.productService.deleteCatalogCategory(categoryId, body.actorId);
    return { success: true, data: category };
  }

  // Public read — facets are public search data
  @Public()
  @Get('catalog/facets')
  async getFacets(@Query() query: any) {
    const facets = await this.productService.getFacets(query);
    return { success: true, data: facets };
  }

  @Public()
  @UseGuards(OptionalJwtAuthGuard)
  @Get('recommendations/for-me')
  async getRecommendations(@Request() req: any, @Query() query: any) {
    const products = await this.productService.getRecommendedProducts(req.user?.userId, query || {});
    return { success: true, data: products };
  }

  // FIX [PRODUCT-GOVERNANCE]: Was unauthenticated admin report.
  @UseGuards(JwtAuthGuard)
  @Roles(UserRole.ADMIN)
  @Get('catalog/governance')
  async getGovernanceReport() {
    const report = await this.productService.getGovernanceReport();
    return { success: true, data: report };
  }

  // FIX [PRODUCT-BACKFILL]: Was unauthenticated — destructive data migration endpoint.
  @UseGuards(JwtAuthGuard)
  @Roles(UserRole.ADMIN)
  @Post('catalog/migrate-backfill')
  async backfillCatalog(@Body() body: { dryRun?: boolean; limit?: number } = {}) {
    const result = await this.productService.backfillCatalogMetadata(body);
    return { success: true, data: result };
  }

  @UseGuards(JwtAuthGuard)
  @Roles(UserRole.ADMIN)
  @Post('admin/self-heal-seller-links')
  async selfHealSellerLinks(@Body() body: { dryRun?: boolean; limit?: number } = {}) {
    const result = await this.productService.selfHealSellerLinks(body);
    return { success: true, data: result };
  }

  // Public read — individual product pages are public
  @Public()
  @Get(':id')
  async findById(@Param('id') id: string) {
    const product = await this.productService.findById(id);
    return { success: true, data: product };
  }

  @UseGuards(JwtAuthGuard)
  @Post(':id/interactions')
  async recordProductInteraction(@Param('id') id: string, @Body() body: { action?: string } = {}, @Request() req: any) {
    const result = await this.productService.recordProductInteraction(req.user.userId, id, body.action || 'product_view');
    return { success: true, data: result };
  }

  // FIX [PRODUCT-UPDATE]: Was unauthenticated — anyone could modify any product.
  // Deep Audit: Added IDOR ownership check.
  @UseGuards(JwtAuthGuard)
  @Roles(UserRole.SELLER, UserRole.ADMIN)
  @Put(':id')
  async update(@Param('id') id: string, @Body() updateData: any, @Request() req: any) {
    if (req.user.role !== 'ADMIN') {
      const existingProduct = await this.productService.findById(id);
      const sellerProfile = await this.productService.findSellerProfile(req.user.userId);
      if (!sellerProfile || String(existingProduct.sellerId._id || existingProduct.sellerId) !== String(sellerProfile._id)) {
        throw new ForbiddenException('You can only update your own products');
      }
    }
    const product = await this.productService.update(id, updateData);
    return { success: true, data: product };
  }

  // FIX [PRODUCT-DELETE]: Was unauthenticated — anyone could delete products.
  // Deep Audit: Added IDOR ownership check.
  @UseGuards(JwtAuthGuard)
  @Roles(UserRole.SELLER, UserRole.ADMIN)
  @Delete(':id')
  async remove(@Param('id') id: string, @Body() data: { deletedBy?: string; reason?: string } = {}, @Request() req: any) {
    if (req.user.role !== 'ADMIN') {
      const existingProduct = await this.productService.findById(id);
      const sellerProfile = await this.productService.findSellerProfile(req.user.userId);
      if (!sellerProfile || String(existingProduct.sellerId._id || existingProduct.sellerId) !== String(sellerProfile._id)) {
        throw new ForbiddenException('You can only delete your own products');
      }
      data.deletedBy = req.user.userId;
    }
    const product = await this.productService.remove(id, data);
    return { success: true, data: product };
  }

  // FIX [PRODUCT-APPROVE]: Was unauthenticated — anyone could approve products.
  @UseGuards(JwtAuthGuard)
  @Roles(UserRole.ADMIN)
  @Post(':id/approve')
  async approve(@Param('id') id: string) {
    const product = await this.productService.approve(id);
    return { success: true, data: product };
  }

  // FIX [PRODUCT-STOCK]: Was unauthenticated — anyone could manipulate stock counts.
  @UseGuards(JwtAuthGuard)
  @Roles(UserRole.SELLER, UserRole.ADMIN)
  @Post(':id/stock')
  async updateStock(@Param('id') id: string, @Body() data: { change: number }, @Request() req: any) {
    if (req.user.role !== 'ADMIN') {
      const existingProduct = await this.productService.findById(id);
      const sellerProfile = await this.productService.findSellerProfile(req.user.userId);
      if (!sellerProfile || String(existingProduct.sellerId._id || existingProduct.sellerId) !== String(sellerProfile._id)) {
        throw new ForbiddenException('You can only update stock for your own products');
      }
    }
    const product = await this.productService.updateStock(id, data.change);
    return { success: true, data: product };
  }

  // FIX [PRODUCT-IMG-UPLOAD]: Was unauthenticated.
  @UseGuards(JwtAuthGuard)
  @Post('upload-image')
  @UseInterceptors(FileInterceptor('file', { limits: { fileSize: 5 * 1024 * 1024 } }))
  async uploadImage(@UploadedFile() file: any) {
    if (!file) {
      throw new BadRequestException('No image file uploaded');
    }
    const extension = this.extensionFromMime(file.mimetype);
    const fileName = `${randomUUID()}${extension}`;
    const url = await this.storageService.uploadFile(file.buffer, fileName, file.mimetype, 'products');

    return {
      success: true,
      data: { url },
    };
  }

  private extensionFromMime(mimeType: string): string {
    const extension = this.imageExtensions[mimeType];
    if (!extension) {
      throw new BadRequestException('Unsupported image type. Upload JPG, PNG, WebP, or GIF.');
    }
    return extension;
  }

  // FIX [PRODUCT-BULK]: Was unauthenticated.
  @UseGuards(JwtAuthGuard)
  @Roles(UserRole.SELLER, UserRole.ADMIN)
  @Post('bulk-upload')
  @UseInterceptors(FileInterceptor('file', { limits: { fileSize: 5 * 1024 * 1024 } }))
  async bulkUpload(@UploadedFile() file: any, @Body('sellerId') bodySellerId: string, @Request() req: any) {
    if (!file) {
      throw new BadRequestException('No spreadsheet uploaded');
    }

    let sellerId = bodySellerId;
    if (req.user.role !== 'ADMIN') {
      const sellerProfile = await this.productService.findSellerProfile(req.user.userId);
      if (!sellerProfile) throw new ForbiddenException('Seller profile not found');
      sellerId = String(sellerProfile._id);
    }

    if (!sellerId) {
      throw new BadRequestException('Seller ID is required for bulk upload');
    }

    const extension = extname(file.originalname || '').toLowerCase();
    if (!this.bulkMimeTypes.has(file.mimetype) && !['.csv', '.xlsx'].includes(extension)) {
      throw new BadRequestException('Unsupported bulk upload file. Use CSV or XLSX.');
    }

    const results = await this.productService.bulkUpload(file.buffer, sellerId, extension);
    return { success: true, data: results };
  }

  @Public()
  @Get('bulk/template')
  async downloadTemplate(@Res() res: Response) {
    const buffer = await this.productService.generateExcelTemplate();

    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', 'attachment; filename=rmf_bulk_product_template.xlsx');
    res.send(buffer);
  }

  @Public()
  @Post(':id/orders/increment')
  async incrementOrders(@Param('id') id: string, @Body() data: { count: number }, @Request() req: any) {
    this.verifyInternalService(req);
    const requestedCount = Math.floor(Number(data?.count || 1));
    const count = Math.min(Math.max(Number.isFinite(requestedCount) ? requestedCount : 1, 1), 1000);
    const product = await this.productService.incrementOrders(id, count);
    return { success: true, data: product };
  }
}
