import { Type } from 'class-transformer';
import { IsBoolean, IsEnum, IsInt, IsOptional, Max, Min } from 'class-validator';
import { UserRole } from '@nest/shared-types';

// API Contract §5 GET /users query params — validated the same as any
// other input, per Security Design §7's "URL/query parameters... validated
// against an explicit allow-list."
export class ListUsersQueryDto {
  @IsOptional()
  @IsEnum(UserRole)
  role?: UserRole;

  @IsOptional()
  @Type(() => Boolean)
  @IsBoolean()
  is_active?: boolean;

  // Powers the Admin Approvals screen: "which registrations are waiting
  // on me". Deliberately boolean-only (not a role filter) since the
  // approver cares about "has *a* pending request", not which role was
  // requested, until they open the detail view.
  @IsOptional()
  @Type(() => Boolean)
  @IsBoolean()
  has_pending_role?: boolean;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number = 1;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100) // API Contract §1.4 — page_size capped at 100 server-side regardless of request
  page_size?: number = 25;
}
