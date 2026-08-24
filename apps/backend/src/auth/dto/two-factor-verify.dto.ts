import { IsString, Length } from 'class-validator';

export class TwoFactorVerifyDto {
  @IsString()
  pending_token!: string;

  @IsString()
  @Length(6, 10) // 6-digit TOTP or a longer recovery code
  code!: string;
}
