import { IsEmail, IsString, MinLength, IsBoolean, IsOptional } from 'class-validator';

// API Contract §4 POST /auth/login — request DTO. class-validator +
// the global ValidationPipe's forbidNonWhitelisted (main.ts) means any
// field beyond these two is rejected outright, not silently dropped.
export class LoginDto {
  @IsEmail()
  email!: string;

  @IsString()
  @MinLength(1)
  password!: string;

  @IsBoolean()
  @IsOptional()
  remember_me?: boolean;
}
