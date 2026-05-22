import {
  ArrayMaxSize,
  IsArray,
  IsEmail,
  IsEnum,
  IsNotEmpty,
  IsObject,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
} from 'class-validator';
import { UserRole } from '@rmf/shared-types';

export class RegisterDto {
  @IsString()
  @IsNotEmpty({ message: 'Full name is required' })
  @MaxLength(120, { message: 'Full name is too long' })
  fullName!: string;

  @IsEmail({}, { message: 'Valid email is required' })
  @MaxLength(180, { message: 'Email is too long' })
  email!: string;

  @IsString()
  @MinLength(8, { message: 'Password must be at least 8 characters' })
  @MaxLength(128, { message: 'Password is too long' })
  password!: string;

  @IsString()
  @IsNotEmpty({ message: 'Phone number is required' })
  @MaxLength(32, { message: 'Phone number is too long' })
  phone!: string;

  @IsOptional()
  @IsEnum(UserRole, { message: 'Role must be a valid user role' })
  role?: UserRole;

  @IsOptional()
  @IsString()
  @MaxLength(64, { message: 'Referral code is too long' })
  referredBy?: string;

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(30)
  @IsString({ each: true })
  @MaxLength(80, { each: true })
  preferredCategoryIds?: string[];

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(30)
  @IsString({ each: true })
  @MaxLength(80, { each: true })
  categoryIds?: string[];

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(30)
  @IsString({ each: true })
  @MaxLength(64, { each: true })
  preferredMarketIds?: string[];

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(30)
  @IsString({ each: true })
  @MaxLength(64, { each: true })
  marketIds?: string[];

  @IsOptional()
  @IsObject()
  preferences?: Record<string, unknown>;
}
