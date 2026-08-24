import { IsEnum, IsNotEmpty, IsOptional, IsString, IsUUID } from 'class-validator';
import { LocationType } from '@nest/shared-types';

export class CreateLocationDto {
  @IsString()
  @IsNotEmpty()
  name!: string;

  @IsEnum(LocationType)
  type!: LocationType;

  @IsOptional()
  @IsUUID()
  parent_location_id?: string | null;

  @IsOptional()
  @IsString()
  description?: string | null;
}
