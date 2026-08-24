import { IsString, IsOptional, IsBoolean, MaxLength } from 'class-validator';

export class UpdateAssetDefinitionDto {
  @IsString()
  @IsOptional()
  @MaxLength(200)
  name?: string;

  @IsString()
  @IsOptional()
  description?: string;

  @IsString()
  @IsOptional()
  @MaxLength(100)
  manufacturer?: string;

  @IsString()
  @IsOptional()
  @MaxLength(100)
  model_number?: string;

  @IsBoolean()
  @IsOptional()
  is_consumable?: boolean;

  @IsBoolean()
  @IsOptional()
  requires_return?: boolean;
}
