import { IsString, IsNumber, IsObject, IsOptional, Min, ValidateNested, IsArray, IsNotEmpty } from 'class-validator';
import { Type } from 'class-transformer';

class FinancialsDto {
  @IsNumber()
  @Min(1)
  subtotal!: number;

  @IsNumber()
  @Min(0)
  deliveryFee!: number;

  @IsNumber()
  @Min(0)
  platformCommission!: number;

  @IsNumber()
  @Min(0)
  totalAmount!: number;
}

class BuyerDto {
  @IsString()
  @IsNotEmpty()
  userId!: string;

  @IsString()
  @IsNotEmpty()
  fullName!: string;

  @IsString()
  @IsNotEmpty()
  phone!: string;

  @IsOptional()
  @IsObject()
  deliveryAddress?: Record<string, any>;
}

class ProductDto {
  @IsString()
  @IsNotEmpty()
  productId!: string;

  @IsString()
  @IsNotEmpty()
  name!: string;

  @IsNumber()
  @Min(1)
  unitPrice!: number;

  @IsNumber()
  @Min(1)
  quantity!: number;
}

class SellerDto {
  @IsString()
  @IsNotEmpty()
  userId!: string;

  @IsString()
  @IsNotEmpty()
  marketId!: string;
}

export class CreateOrderDto {
  @ValidateNested()
  @Type(() => FinancialsDto)
  financials!: FinancialsDto;

  @ValidateNested()
  @Type(() => BuyerDto)
  buyer!: BuyerDto;

  @ValidateNested()
  @Type(() => ProductDto)
  product!: ProductDto;

  @ValidateNested()
  @Type(() => SellerDto)
  seller!: SellerDto;

  @IsOptional()
  @IsObject()
  payment?: Record<string, any>;

  @IsOptional()
  @IsObject()
  schedule?: Record<string, any>;

  @IsOptional()
  @IsObject()
  security?: Record<string, any>;
}
