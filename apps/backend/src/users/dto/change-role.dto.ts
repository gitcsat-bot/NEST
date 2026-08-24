import { IsEnum } from 'class-validator';
import { UserRole } from '@nest/shared-types';

export class ChangeRoleDto {
  @IsEnum(UserRole)
  role!: UserRole;
}
