import { IsOptional, IsString } from 'class-validator';

export class CreateDeletionRequestDto {
  @IsOptional()
  @IsString()
  reason?: string | null;
}
