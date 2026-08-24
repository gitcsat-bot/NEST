import { IsEnum, IsNotEmpty, IsOptional, IsString, IsUUID } from 'class-validator';
import { LocationType } from '@nest/shared-types';

export class UpdateLocationDto {
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  name?: string;

  @IsOptional()
  @IsEnum(LocationType)
  type?: LocationType;

  @IsOptional()
  @IsUUID()
  parent_location_id?: string | null;

  @IsOptional()
  @IsString()
  description?: string | null;
}
