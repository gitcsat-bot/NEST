import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { UserRole, roleAtLeast } from '@nest/shared-types';
import { ROLES_KEY } from '../decorators/roles.decorator';
import { ApiExceptions } from '../../common/dto/api-exception';
import { AuthenticatedRequest } from './session-auth.guard';

// TDS §5.2, layer 1 of 2: "does this role have the capability at all."
// Cheap — a static in-code check via ROLE_HIERARCHY (shared-types), no DB
// query. Runs after SessionAuthGuard (which populates request.user) and
// before any handler logic (Security Design §6: authorization evaluated
// before data is fetched, never after).
@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const required = this.reflector.getAllAndOverride<UserRole[]>(ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    // No @Roles() present → route requires authentication only (already
    // handled by SessionAuthGuard), any authenticated role may proceed.
    if (!required || required.length === 0) return true;

    const { user } = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const minimumRole = required[0];
    if (!roleAtLeast(user.role, minimumRole)) {
      throw ApiExceptions.forbidden();
    }
    return true;
  }
}
