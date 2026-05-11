import { IsString, IsEmail, MinLength, IsOptional, IsEnum, IsNotEmpty } from 'class-validator';
import { UserRole } from '@rmf/shared-types';

export class RegisterDto {
  @IsString()
  @IsNotEmpty({ message: 'Full name is required' })
  fullName!: string;

  @IsEmail({}, { message: 'Valid email is required' })
  email!: string;

  @IsString()
  @MinLength(8, { message: 'Password must be at least 8 characters' })
  password!: string;

  @IsString()
  @IsNotEmpty({ message: 'Phone number is required' })
  phone!: string;

  @IsOptional()
  @IsEnum(UserRole, { message: 'Role must be a valid user role' })
  role?: UserRole;

  @IsOptional()
  @IsString()
  referredBy?: string;
}
