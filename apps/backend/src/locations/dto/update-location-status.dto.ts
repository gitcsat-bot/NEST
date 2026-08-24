import { IsEnum, IsNotEmpty } from 'class-validator';
import { LocationStatus } from '@nest/shared-types';

export class UpdateLocationStatusDto {
  @IsEnum(LocationStatus)
  @IsNotEmpty()
  status!: LocationStatus;
}
