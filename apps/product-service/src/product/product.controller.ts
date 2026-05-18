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
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { randomUUID } from 'crypto';
import { existsSync, mkdirSync, writeFileSync } from 'fs';
import { extname, join } from 'path';
import { Response } from 'express';
import { ProductService } from './product.service';
import { Roles, JwtAuthGuard } from '@rmf/auth';
import { UserRole } from '@rmf/shared-types';
import { StorageService } from '../storage/storage.service';

@Controller('products')
export class ProductController {
  constructor(
    private readonly productService: ProductService,
    private readonly storageService: StorageService,
  ) {}

  @Get('test-read-template')
  async testReadTemplate() {
    const XLSX = require('xlsx');
    try {
      const filePath = 'c:/Users/mahor/.gemini/antigravity/scratch/Rwanda-online-shop/rmf_bulk_product_template.xlsx';
      const wb = XLSX.readFile(filePath);
      const res: Record<string, any> = {};
      wb.SheetNames.forEach((name: string) => {
        const ws = wb.Sheets[name];
        res[name] = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '' });
      });
      return { success: true, data: res };
    } catch (e: any) {
      return { success: false, error: e.message };
    }
  }

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
    'application/vnd.ms-excel',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  ]);

  // FIX [PRODUCT-CREATE]: Was unauthenticated — anyone could create products.
  // Now requires SELLER or ADMIN role.
  @UseGuards(JwtAuthGuard)
  @Roles(UserRole.SELLER, UserRole.ADMIN)
  @Post()
  async create(@Body() productData: any) {
    const product = await this.productService.create(productData);
    return { success: true, data: product };
  }

  // Public read — product listings are public marketplace data
  @Get()
  async findAll(@Query() query: any) {
    const products = await this.productService.findAll(query);
    return { success: true, data: products };
  }

  @Get('catalog/categories')
  async getCatalogCategories(@Query('includeInactive') includeInactive?: string) {
    const categories = await this.productService.getCatalogCategories(includeInactive === 'true');
    return { success: true, data: categories };
  }

  // FIX [PRODUCT-CAT-UPSERT]: Was unauthenticated — anyone could modify catalog categories.
  @UseGuards(JwtAuthGuard)
  @Roles(UserRole.ADMIN)
  @Post('catalog/categories')
  async upsertCatalogCategory(@Body() categoryData: any) {
    const category = await this.productService.upsertCatalogCategory(categoryData);
    return { success: true, data: category };
  }

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
  @Get('catalog/facets')
  async getFacets(@Query() query: any) {
    const facets = await this.productService.getFacets(query);
    return { success: true, data: facets };
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

  // Public read — individual product pages are public
  @Get(':id')
  async findById(@Param('id') id: string) {
    const product = await this.productService.findById(id);
    return { success: true, data: product };
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
    if (!this.bulkMimeTypes.has(file.mimetype) && !['.csv', '.xlsx', '.xls'].includes(extension)) {
      throw new BadRequestException('Unsupported bulk upload file. Use CSV, XLS, or XLSX.');
    }

    const results = await this.productService.bulkUpload(file.buffer, sellerId);
    return { success: true, data: results };
  }

  @Get('bulk/template')
  async downloadTemplate(@Res() res: Response) {
    const buffer = this.productService.generateExcelTemplate();
    
    try {
      const filePath = join(process.cwd(), 'rmf_bulk_product_template.xlsx');
      const absoluteFallbackPath = 'c:/Users/mahor/.gemini/antigravity/scratch/Rwanda-online-shop/rmf_bulk_product_template.xlsx';
      
      const fs = require('fs');
      fs.writeFileSync(filePath, buffer);
      if (filePath !== absoluteFallbackPath) {
        fs.writeFileSync(absoluteFallbackPath, buffer);
      }
      console.log('[BulkUpload] Successfully synchronized rmf_bulk_product_template.xlsx on disk.');
    } catch (err: any) {
      console.warn('[BulkUpload] Could not write updated template to workspace root disk:', err.message);
    }

    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', 'attachment; filename=rmf_bulk_product_template.xlsx');
    res.send(buffer);
  }
}
