import { Type } from 'class-transformer';
import { IsEnum, IsInt, IsOptional, Max, Min } from 'class-validator';
import { InventoryRequestStatus } from '@nest/shared-types';

export class ListDeletionRequestsQueryDto {
  @IsOptional()
  @IsEnum(InventoryRequestStatus)
  status?: InventoryRequestStatus;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number = 1;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  page_size?: number = 25;
}
