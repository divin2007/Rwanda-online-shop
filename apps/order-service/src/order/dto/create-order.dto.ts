import { IsString, IsNumber, IsObject, IsOptional, Min, ValidateNested, IsArray, IsNotEmpty, IsIn } from 'class-validator';
import { Type } from 'class-transformer';

class FinancialsDto {
  @IsNumber()
  @Min(0)
  subtotal!: number;

  @IsNumber()
  @Min(0)
  deliveryFee!: number;

  @IsNumber()
  @Min(0)
  platformCommission!: number;

  @IsNumber()
  @Min(0)
  gatewayFee!: number;

  @IsNumber()
  @Min(0)
  totalAmount!: number;

  @IsNumber()
  @Min(0)
  sellerPayout!: number;

  @IsNumber()
  @Min(0)
  riderPayout!: number;
}

class BuyerDto {
  @IsString()
  @IsNotEmpty()
  userId!: string;

  @IsString()
  @IsNotEmpty()
  fullName!: string;

  @IsOptional()
  @IsString()
  phone?: string;

  @IsOptional()
  @IsString()
  nationalId?: string;

  @IsOptional()
  @IsObject()
  deliveryAddress?: Record<string, any>;
}

class ProductDto {
  @IsOptional()
  @IsString()
  productId?: string;

  @IsOptional()
  @IsString()
  menuItemId?: string;

  @IsOptional()
  isMenuItem?: boolean;

  @IsString()
  @IsNotEmpty()
  name!: string;

  @IsNumber()
  @Min(0)
  unitPrice!: number;

  @IsNumber()
  @Min(1)
  quantity!: number;

  @IsOptional()
  @IsString()
  customization?: string;

  @IsOptional()
  @IsString()
  prototypeImage?: string;

  @IsOptional()
  @IsString()
  unit?: string;

  @IsOptional()
  @IsString()
  category?: string;

  @IsOptional()
  @IsString()
  categoryId?: string;

  @IsOptional()
  @IsString()
  imageUrl?: string;

  @IsOptional()
  @IsArray()
  images?: string[];

  @IsOptional()
  @IsObject()
  attributes?: Record<string, any>;

  @IsOptional()
  @IsString()
  variantId?: string;

  @IsOptional()
  @IsString()
  variantTitle?: string;

  @IsOptional()
  @IsString()
  sellerSku?: string;

  @IsOptional()
  priceSnapshotAt?: any;
}

class SellerDto {
  @IsString()
  @IsNotEmpty()
  sellerId!: string;

  @IsOptional()
  @IsString()
  userId?: string;

  @IsOptional()
  @IsString()
  fullName?: string;

  @IsOptional()
  @IsString()
  stallId?: string;

  @IsOptional()
  @IsString()
  marketId?: string;
}

export class CreateOrderDto {
  @ValidateNested()
  @Type(() => FinancialsDto)
  financials!: FinancialsDto;

  @ValidateNested()
  @Type(() => BuyerDto)
  buyer!: BuyerDto;

  @IsOptional()
  @ValidateNested()
  @Type(() => ProductDto)
  product?: ProductDto;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ProductDto)
  products?: ProductDto[];

  @ValidateNested()
  @Type(() => SellerDto)
  seller!: SellerDto;
  
  @IsOptional()
  @IsString()
  notes?: string;

  @IsOptional()
  @IsString()
  status?: string;

  @IsOptional()
  @IsObject()
  attributes?: Record<string, any>;

  // 5B fix: validate payment method against allowed providers
  @IsOptional()
  @IsObject()
  payment?: {
    method?: 'MTN_MOMO';
    [key: string]: any;
  };

  @IsOptional()
  @IsObject()
  schedule?: Record<string, any>;

  @IsOptional()
  @IsObject()
  security?: Record<string, any>;

  // Affiliate referral attribution (Feature 3). The slug of the ReferralLink that
  // brought the buyer here; validated and credited server-side after escrow release.
  @IsOptional()
  @IsString()
  affiliateCode?: string;

  // Live selling attribution (Feature 2). Set when the order originates from a live session.
  @IsOptional()
  @IsString()
  liveSessionId?: string;
}
