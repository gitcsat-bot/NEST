import { IsEnum, IsOptional, IsString, Length } from 'class-validator';
import { Gender, MIS_BRANCHES } from '@nest/shared-types';
import { ValidatorConstraint, ValidatorConstraintInterface, Validate } from 'class-validator';

@ValidatorConstraint({ name: 'isMisId', async: false })
export class IsMisIdConstraint implements ValidatorConstraintInterface {
  validate(misId: string) {
    if (!/^\d{9}$/.test(misId)) return false;
    
    const degreeCode = misId.substring(0, 2);
    if (degreeCode !== '61' && degreeCode !== '71') return false;
    
    const branchCode = misId.substring(4, 6);
    if (!MIS_BRANCHES[branchCode]) return false;
    
    return true;
  }

  defaultMessage() {
    return 'Invalid MIS ID. Must be 9 digits, start with 61 or 71, and contain a valid branch code.';
  }
}

export class UpdateProfileDto {
  @IsOptional()
  @IsString()
  @Length(2, 100)
  displayName?: string;

  @IsOptional()
  @IsString()
  @Validate(IsMisIdConstraint)
  misId?: string;

  @IsOptional()
  @IsEnum(Gender)
  gender?: Gender;
}
