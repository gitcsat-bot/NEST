import { IsEnum, IsInt, IsOptional, IsString, IsUUID, Min } from 'class-validator';
import { AssetStatus } from '@nest/shared-types';

export class CreateMaterialDto {
  @IsUUID()
  asset_definition_id!: string;

  @IsOptional()
  @IsUUID()
  location_id?: string | null;

  @IsOptional()
  @IsString()
  unit?: string;

  @IsOptional()
  @IsEnum(AssetStatus)
  status?: AssetStatus;

  @IsOptional()
  @IsInt()
  @Min(0)
  quantity_on_hand?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  reorder_threshold?: number | null;

  @IsOptional()
  @IsString()
  notes?: string | null;
}
