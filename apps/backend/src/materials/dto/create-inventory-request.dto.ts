import { IsInt, IsOptional, IsString, Min } from 'class-validator';

export class CreateInventoryRequestDto {
  @IsInt()
  @Min(1)
  requested_quantity!: number;

  @IsOptional()
  @IsString()
  reason?: string | null;
}
