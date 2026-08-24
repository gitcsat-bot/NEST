import { Injectable } from '@nestjs/common';
import { UserRole } from '@nest/shared-types';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { ApiExceptions } from '../common/dto/api-exception';
import { toSharedUserRole } from '../common/mappers/user-role.mapper';
import { UserRole as PrismaUserRole } from '../../generated/prisma';
import { UpdateProfileDto } from './dto/update-profile.dto';
import { UpdatePasswordDto } from './dto/update-password.dto';
import * as argon2 from 'argon2';

// API Contract Â§5. Field-level write protection (Security Design Â§5.3):
// `role`/`is_active` are never accepted from a generic PATCH â€” each has
// its own dedicated, audited, step-up-gated method below, matching the
// API Contract's endpoint-per-transition shape rather than a single
// "update user" catch-all.
@Injectable()
export class UsersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  async findById(id: string) {
    const user = await this.prisma.user.findUnique({ where: { id } });
    if (!user) throw ApiExceptions.notFound('User');
    return this.toDto(user);
  }

  async list(filters: { role?: UserRole; isActive?: boolean; hasPendingRole?: boolean; page: number; pageSize: number }) {
    const where = {
      ...(filters.role ? { role: filters.role } : {}),
      ...(filters.isActive !== undefined ? { isActive: filters.isActive } : {}),
      ...(filters.hasPendingRole !== undefined
        ? { pendingRole: filters.hasPendingRole ? { not: null } : null }
        : {}),
    };
    const [items, total] = await Promise.all([
      this.prisma.user.findMany({
        where,
        skip: (filters.page - 1) * filters.pageSize,
        take: filters.pageSize,
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.user.count({ where }),
    ]);
    return {
      items: items.map((u) => this.toDto(u)),
      total,
      page: filters.page,
      page_size: filters.pageSize,
    };
  }

  // API Contract Â§5: "cannot target self" â€” Security Design Â§3.2
  // elevation-of-privilege mitigation.
  async changeRole(targetId: string, newRole: UserRole, actorId: string) {
    if (targetId === actorId) {
      throw ApiExceptions.validation([
        { field: 'id', message: 'You cannot change your own role.' },
      ]);
    }
    const before = await this.prisma.user.findUnique({ where: { id: targetId } });
    if (!before) throw ApiExceptions.notFound('User');

    const after = await this.prisma.$transaction(async (tx) => {
      const updated = await tx.user.update({ where: { id: targetId }, data: { role: newRole } });
      await this.audit.record({
        actorUserId: actorId,
        action: 'user.role_changed',
        targetType: 'user',
        targetId,
        beforeState: { role: before.role },
        afterState: { role: newRole },
      });
      return updated;
    });
    return this.toDto(after);
  }

  async approveRole(targetId: string, actorId: string) {
    if (targetId === actorId) {
      throw ApiExceptions.validation([
        { field: 'id', message: 'You cannot approve your own role.' },
      ]);
    }
    const before = await this.prisma.user.findUnique({ where: { id: targetId } });
    if (!before) throw ApiExceptions.notFound('User');
    if (!before.pendingRole) {
      throw ApiExceptions.validation([
        { field: 'id', message: 'User has no pending role to approve.' }
      ]);
    }

    const newRole = before.pendingRole;
    const after = await this.prisma.$transaction(async (tx) => {
      const updated = await tx.user.update({
        where: { id: targetId },
        data: { role: newRole, pendingRole: null }
      });
      await this.audit.record({
        actorUserId: actorId,
        action: 'user.role_approved' as any,
        targetType: 'user',
        targetId,
        beforeState: { role: before.role, pendingRole: before.pendingRole },
        afterState: { role: newRole, pendingRole: null },
      });
      return updated;
    });
    return this.toDto(after);
  }

  async rejectRole(targetId: string, actorId: string) {
    if (targetId === actorId) {
      throw ApiExceptions.validation([
        { field: 'id', message: 'You cannot reject your own role request.' },
      ]);
    }
    const before = await this.prisma.user.findUnique({ where: { id: targetId } });
    if (!before) throw ApiExceptions.notFound('User');
    if (!before.pendingRole) {
      throw ApiExceptions.validation([
        { field: 'id', message: 'User has no pending role to reject.' }
      ]);
    }

    const newAfter = await this.prisma.$transaction(async (tx) => {
      const updated = await tx.user.update({
        where: { id: targetId },
        data: { pendingRole: null },
      });
      await this.audit.record({
        actorUserId: actorId,
        action: 'user.role_rejected' as any,
        targetType: 'user',
        targetId,
        beforeState: { pendingRole: before.pendingRole },
        afterState: { pendingRole: null },
      });
      return updated;
    });
    return this.toDto(newAfter);
  }

  // Deactivation revokes all sessions synchronously before responding â€”
  // API Contract Â§5, Security Acceptance Criterion #13's guarantee
  // depends on this happening here, not just on SessionAuthGuard's
  // per-request isActive re-check (both layers matter: this makes
  // existing sessions unusable immediately; the guard is the backstop
  // for any session this transaction somehow missed).
  async deactivate(targetId: string, actorId: string) {
    const after = await this.prisma.$transaction(async (tx) => {
      const updated = await tx.user.update({
        where: { id: targetId },
        data: { isActive: false, deactivatedAt: new Date() },
      });
      await tx.session.updateMany({
        where: { userId: targetId, revokedAt: null },
        data: { revokedAt: new Date() },
      });
      await this.audit.record({
        actorUserId: actorId,
        action: 'user.deactivated',
        targetType: 'user',
        targetId,
      });
      return updated;
    });
    return this.toDto(after);
  }

  async reactivate(targetId: string, actorId: string) {
    const after = await this.prisma.$transaction(async (tx) => {
      const updated = await tx.user.update({
        where: { id: targetId },
        data: { isActive: true, deactivatedAt: null },
      });
      await this.audit.record({
        actorUserId: actorId,
        action: 'user.reactivated',
        targetType: 'user',
        targetId,
      });
      return updated;
    });
    return this.toDto(after);
  }

  async requestRole(userId: string, requestedRole: UserRole) {
    const updated = await this.prisma.user.update({
      where: { id: userId },
      data: { pendingRole: requestedRole as PrismaUserRole },
    });
    await this.audit.record({
      actorUserId: userId,
      action: 'user.profile_updated' as any,
      targetType: 'user',
      targetId: userId,
      afterState: { pendingRole: requestedRole },
    });
    return this.toDto(updated);
  }

  async updateProfile(userId: string, dto: UpdateProfileDto) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw ApiExceptions.notFound('User');

    const data: any = {};
    if (dto.displayName) data.displayName = dto.displayName;
    if (dto.misId !== undefined) data.misId = dto.misId;
    if (dto.gender !== undefined) data.gender = dto.gender as any; // Prisma enum match

    if (Object.keys(data).length === 0) return this.toDto(user);

    try {
      const updated = await this.prisma.user.update({
        where: { id: userId },
        data,
      });

      await this.audit.record({
        actorUserId: userId,
        action: 'user.profile_updated',
        targetType: 'user',
        targetId: userId,
      });

      return this.toDto(updated);
    } catch (error: any) {
      if (error.code === 'P2002') {
        throw ApiExceptions.validation([{ field: 'mis_id', message: 'This MIS ID is already registered to another account.' }]);
      }
      throw error;
    }
  }

  async updatePassword(userId: string, dto: UpdatePasswordDto) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw ApiExceptions.notFound('User');

    const isValid = await argon2.verify(user.passwordHash, dto.currentPassword);
    if (!isValid) throw ApiExceptions.invalidCredentials();

    const passwordHash = await argon2.hash(dto.newPassword);
    const updated = await this.prisma.user.update({
      where: { id: userId },
      data: { passwordHash },
    });

    await this.audit.record({
      actorUserId: userId,
      action: 'user.password_updated',
      targetType: 'user',
      targetId: userId,
    });

    return this.toDto(updated);
  }

  private toDto(user: {
    id: string;
    email: string;
    displayName: string;
    role: PrismaUserRole;
    pendingRole: PrismaUserRole | null;
    isActive: boolean;
    totpEnabled: boolean;
    misId: string | null;
    gender: any;
    whatsappNumber: string | null;
    subsystem: string | null;
    teamRole: string | null;
    createdAt: Date;
    deactivatedAt: Date | null;
    updatedAt: Date;
  }) {
    return {
      id: user.id,
      email: user.email,
      display_name: user.displayName,
      role: toSharedUserRole(user.role),
      pending_role: user.pendingRole ? toSharedUserRole(user.pendingRole) : null,
      mis_id: user.misId,
      gender: user.gender,
      whatsapp_number: user.whatsappNumber,
      subsystem: user.subsystem,
      team_role: user.teamRole,
      is_active: user.isActive,
      totp_enabled: user.totpEnabled,
      created_at: user.createdAt.toISOString(),
      deactivated_at: user.deactivatedAt?.toISOString() ?? null,
    };
  }
}
