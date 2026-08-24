import { UserRole } from '@nest/shared-types';
import { UserRole as PrismaUserRole } from '../../../generated/prisma';

// Prisma generates its own enum type from schema.prisma's `enum UserRole`
// block — structurally identical string values to @nest/shared-types'
// UserRole, but a nominally different TypeScript type, so TS correctly
// refuses to assign one to the other without help (this is what produced
// TS2322 in session-auth.guard.ts). Every place a Prisma-sourced role
// value needs to become our shared UserRole goes through this one
// function, so the cast lives in exactly one reviewed place rather than
// being repeated (and potentially done inconsistently) at each call site.
export function toSharedUserRole(role: PrismaUserRole): UserRole {
  return role as unknown as UserRole;
}
