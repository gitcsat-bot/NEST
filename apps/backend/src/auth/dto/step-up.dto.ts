import { IsOptional, IsString } from 'class-validator';

export class StepUpDto {
  @IsString()
  password!: string;

  @IsOptional()
  @IsString()
  totp_code?: string;
}
