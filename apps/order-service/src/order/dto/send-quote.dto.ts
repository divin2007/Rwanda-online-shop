import { IsNotEmpty, IsNumber, IsOptional, IsString, Min, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';

export class QuoteFinancialsDto {
  @IsNumber()
  @Min(1)
  subtotal: number;

  @IsNumber()
  @Min(0)
  deliveryFee: number;

  @IsOptional()
  @IsNumber()
  gatewayFee?: number;

  @IsOptional()
  @IsString()
  note?: string;
}

export class SendQuoteDto {
  @ValidateNested()
  @Type(() => QuoteFinancialsDto)
  @IsNotEmpty()
  financials: QuoteFinancialsDto;
}