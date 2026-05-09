import { IsString, IsOptional, IsEnum, IsNumber } from 'class-validator';

export class AddMessageDto {
  @IsString()
  senderId: string;

  @IsEnum(['BUYER', 'SELLER'])
  senderRole: string;

  @IsString()
  content: string;

  @IsOptional()
  @IsString()
  imageUrl?: string;

  @IsOptional()
  @IsString()
  type?: string;

  @IsOptional()
  @IsNumber()
  quoteAmount?: number;
}
