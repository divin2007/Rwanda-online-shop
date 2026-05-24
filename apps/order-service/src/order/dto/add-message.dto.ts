import { IsString, IsOptional, IsNumber, IsIn } from 'class-validator';

export class AddMessageDto {
  @IsString()
  senderId: string;

  @IsIn(['BUYER', 'SELLER', 'RIDER', 'ADMIN'])
  senderRole: string;

  @IsString()
  content: string;

  @IsOptional()
  @IsString()
  imageUrl?: string;

  @IsOptional()
  @IsIn(['ORDER', 'DELIVERY', 'DISPUTE'])
  channel?: string;

  @IsOptional()
  @IsIn(['BUYER', 'SELLER', 'RIDER', 'ADMIN'])
  recipientRole?: string;

  @IsOptional()
  @IsString()
  type?: string;

  @IsOptional()
  @IsNumber()
  quoteAmount?: number;
}
