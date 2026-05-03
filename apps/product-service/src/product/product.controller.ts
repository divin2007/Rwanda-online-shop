import { Controller, Get, Post, Put, Body, Param, Query } from '@nestjs/common';
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
  async uploadImage(@Body() data: any) {
    // Mock upload logic
    return { 
      success: true, 
      data: { url: "https://placehold.co/600x400/000000/FFFFFF/png?text=Product+Photo" } 
    };
  }
}
