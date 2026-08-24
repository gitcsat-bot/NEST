import { IsEnum } from 'class-validator';
import { AssetStatus } from '@nest/shared-types';

export class UpdateMaterialStatusDto {
  @IsEnum(AssetStatus)
  status!: AssetStatus;
}
