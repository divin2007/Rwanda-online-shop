import { Controller, Get, Post, Put, Body, Param, Query, UseInterceptors, UploadedFile } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ProductService } from './product.service';

@Controller('products')
export class ProductController {
  constructor(private readonly productService: ProductService) {}

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

  @Post(':id/stock')
  async updateStock(@Param('id') id: string, @Body() data: { change: number }) {
    const product = await this.productService.updateStock(id, data.change);
    return { success: true, data: product };
  }

  @Post('upload-image')
  @UseInterceptors(FileInterceptor('file'))
  async uploadImage(@UploadedFile() file: any) {
    if (!file) {
      return { success: false, message: 'No file uploaded' };
    }
    
    // In dev, we convert to base64 so the user sees THEIR image immediately
    const base64 = file.buffer.toString('base64');
    const dataUri = `data:${file.mimetype};base64,${base64}`;
    
    return { 
      success: true, 
      data: { url: dataUri } 
    };
  }
}
