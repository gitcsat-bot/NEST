import { SetMetadata } from '@nestjs/common';
import { UserRole } from '@nest/shared-types';

// TDS §5.1 role capability matrix, applied per-route. Usage:
//   @Roles(UserRole.STORES_MANAGER)
// means "this role or higher" — RolesGuard checks via roleAtLeast(),
// not an exact match, matching the hierarchy already defined in
// shared-types so frontend and backend can never disagree on ordering.
export const ROLES_KEY = 'roles';
export const Roles = (...roles: UserRole[]) => SetMetadata(ROLES_KEY, roles);
