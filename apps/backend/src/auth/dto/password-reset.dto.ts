import { IsEmail, IsString, MinLength } from 'class-validator';

export class PasswordResetRequestDto {
  @IsEmail()
  email!: string;
}

export class PasswordResetConfirmDto {
  @IsString()
  token!: string;

  // TDS/PRD password policy is enforced fully in AuthService (length here
  // is a first-pass floor, not the whole policy) — see Security Design §5.
  @IsString()
  @MinLength(12)
  new_password!: string;
}
