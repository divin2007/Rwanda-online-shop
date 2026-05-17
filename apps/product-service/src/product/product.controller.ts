import { BadRequestException, Controller, Delete, Get, Post, Put, Body, Param, Query, UseInterceptors, UploadedFile } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { randomUUID } from 'crypto';
import { existsSync, mkdirSync, writeFileSync } from 'fs';
import { extname, join } from 'path';
import { ProductService } from './product.service';

@Controller('products')
export class ProductController {
  constructor(private readonly productService: ProductService) {}

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

  @Post()
  async create(@Body() productData: any) {
    const product = await this.productService.create(productData);
    return { success: true, data: product };
  }

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

  @Put('catalog/categories/:categoryId')
  async updateCatalogCategory(@Param('categoryId') categoryId: string, @Body() categoryData: any) {
    const category = await this.productService.upsertCatalogCategory({ ...categoryData, id: categoryId });
    return { success: true, data: category };
  }

  @Delete('catalog/categories/:categoryId')
  async deleteCatalogCategory(@Param('categoryId') categoryId: string, @Body() body: { actorId?: string } = {}) {
    const category = await this.productService.deleteCatalogCategory(categoryId, body.actorId);
    return { success: true, data: category };
  }

  @Get('catalog/facets')
  async getFacets(@Query() query: any) {
    const facets = await this.productService.getFacets(query);
    return { success: true, data: facets };
  }

  @Get('catalog/governance')
  async getGovernanceReport() {
    const report = await this.productService.getGovernanceReport();
    return { success: true, data: report };
  }

  @Post('catalog/migrate-backfill')
  async backfillCatalog(@Body() body: { dryRun?: boolean; limit?: number } = {}) {
    const result = await this.productService.backfillCatalogMetadata(body);
    return { success: true, data: result };
  }

  @Get(':id')
  async findById(@Param('id') id: string) {
    const product = await this.productService.findById(id);
    return { success: true, data: product };
  }

  @Put(':id')
  async update(@Param('id') id: string, @Body() updateData: any) {
    const product = await this.productService.update(id, updateData);
    return { success: true, data: product };
  }

  @Delete(':id')
  async remove(@Param('id') id: string, @Body() data: { deletedBy?: string; reason?: string } = {}) {
    const product = await this.productService.remove(id, data);
    return { success: true, data: product };
  }

  @Post(':id/approve')
  async approve(@Param('id') id: string) {
    const product = await this.productService.approve(id);
    return { success: true, data: product };
  }

  @Post(':id/stock')
  async updateStock(@Param('id') id: string, @Body() data: { change: number }) {
    const product = await this.productService.updateStock(id, data.change);
    return { success: true, data: product };
  }

  @Post('upload-image')
  @UseInterceptors(FileInterceptor('file', { limits: { fileSize: 5 * 1024 * 1024 } }))
  async uploadImage(@UploadedFile() file: any) {
    if (!file) {
      throw new BadRequestException('No image file uploaded');
    }
    const extension = this.extensionFromMime(file.mimetype);
    const uploadDir = join(process.cwd(), 'uploads', 'products');
    if (!existsSync(uploadDir)) mkdirSync(uploadDir, { recursive: true });
    const fileName = `${randomUUID()}${extension}`;
    writeFileSync(join(uploadDir, fileName), file.buffer);
    const publicBaseUrl = process.env.PRODUCT_SERVICE_PUBLIC_URL || `http://localhost:${process.env.PORT || 3003}`;
    
    return { 
      success: true, 
      data: { url: `${publicBaseUrl}/uploads/products/${fileName}` } 
    };
  }

  private extensionFromMime(mimeType: string): string {
    const extension = this.imageExtensions[mimeType];
    if (!extension) {
      throw new BadRequestException('Unsupported image type. Upload JPG, PNG, WebP, or GIF.');
    }
    return extension;
  }

  @Post('bulk-upload')
  @UseInterceptors(FileInterceptor('file', { limits: { fileSize: 5 * 1024 * 1024 } }))
  async bulkUpload(@UploadedFile() file: any, @Body('sellerId') sellerId: string) {
    if (!file) {
      throw new BadRequestException('No spreadsheet uploaded');
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
}
