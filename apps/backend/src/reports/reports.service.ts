import { Injectable } from '@nestjs/common';
import { ReservationStatus } from '../../generated/prisma';
import { PrismaService } from '../prisma/prisma.service';

const SECURITY_ACTIONS = [
  'auth.login_failed',
  'auth.2fa_failed',
  'user.role_changed',
  'user.role_approved',
  'user.deactivated',
] as const;

const LOGIN_ACTIONS = ['auth.login_succeeded', 'auth.login_failed'] as const;

@Injectable()
export class ReportsService {
  constructor(private readonly prisma: PrismaService) {}

  async securityReport(windowDays: number) {
    const since = sinceDate(windowDays);

    const [failedLoginCount, accountLockedCount, twoFactorFailureCount, roleChangeCount, deactivationCount, recentEvents] =
      await Promise.all([
        this.prisma.auditLog.count({ where: { action: 'auth.login_failed', createdAt: { gte: since } } }),
        this.prisma.auditLog.count({
          where: {
            action: 'auth.login_failed',
            createdAt: { gte: since },
            afterState: { path: ['reason'], equals: 'account_locked' },
          },
        }),
        this.prisma.auditLog.count({ where: { action: 'auth.2fa_failed', createdAt: { gte: since } } }),
        this.prisma.auditLog.count({
          where: { action: { in: ['user.role_changed', 'user.role_approved'] }, createdAt: { gte: since } },
        }),
        this.prisma.auditLog.count({ where: { action: 'user.deactivated', createdAt: { gte: since } } }),
        this.recentEvents([...SECURITY_ACTIONS], since),
      ]);

    return {
      generated_at: new Date().toISOString(),
      window_days: windowDays,
      failed_login_count: failedLoginCount,
      account_locked_count: accountLockedCount,
      two_factor_failure_count: twoFactorFailureCount,
      role_change_count: roleChangeCount,
      deactivation_count: deactivationCount,
      recent_events: recentEvents,
    };
  }

  async loginReport(windowDays: number) {
    const since = sinceDate(windowDays);

    const [successfulLoginCount, failedLoginCount, distinctUsers, recentEvents] = await Promise.all([
      this.prisma.auditLog.count({ where: { action: 'auth.login_succeeded', createdAt: { gte: since } } }),
      this.prisma.auditLog.count({ where: { action: 'auth.login_failed', createdAt: { gte: since } } }),
      this.prisma.auditLog.findMany({
        where: { action: 'auth.login_succeeded', createdAt: { gte: since }, actorUserId: { not: null } },
        distinct: ['actorUserId'],
        select: { actorUserId: true },
      }),
      this.recentEvents([...LOGIN_ACTIONS], since),
    ]);

    return {
      generated_at: new Date().toISOString(),
      window_days: windowDays,
      successful_login_count: successfulLoginCount,
      failed_login_count: failedLoginCount,
      unique_users_logged_in: distinctUsers.length,
      recent_events: recentEvents,
    };
  }

  async inventoryReport() {
    // Phase 1: inventory is now tracked in inventory_items and reservations tables.
    // Use Prisma delegates instead of raw SQL against dropped materials/inventory_requests.
    const [totalItems, itemsByStatus, lowStockItems, pendingRequests] = await Promise.all([
      // Total inventory items (non-deleted)
      this.prisma.inventoryItem.count({ where: { deletedAt: null } }),

      // Group by derived status: out_of_stock vs available
      Promise.all([
        this.prisma.inventoryItem.count({ where: { deletedAt: null, quantityOnHand: { gt: 0 } } }),
        this.prisma.inventoryItem.count({ where: { deletedAt: null, quantityOnHand: { lte: 0 } } }),
      ]),

      // Low stock: where quantity <= reorderThreshold
      this.prisma.$queryRaw<{ id: string; asset_definition_name: string; quantity_on_hand: number; reorder_threshold: number }[]>`
        SELECT ii.id, ad.name AS asset_definition_name, ii.quantity_on_hand, ii.reorder_threshold
        FROM inventory_items ii
        JOIN asset_definitions ad ON ad.id = ii.asset_definition_id
        WHERE ii.reorder_threshold IS NOT NULL
          AND ii.quantity_on_hand <= ii.reorder_threshold
          AND ii.deleted_at IS NULL
        ORDER BY (ii.reorder_threshold - ii.quantity_on_hand) DESC
        LIMIT 20
      `,

      // Pending requests: reservations in 'active' status targeting inventory items
      this.prisma.reservation.count({
        where: { targetType: 'inventory_item', status: ReservationStatus.active },
      }),
    ]);

    return {
      generated_at: new Date().toISOString(),
      total_materials: totalItems,
      materials_by_status: {
        available: itemsByStatus[0],
        out_of_stock: itemsByStatus[1],
      },
      low_stock_materials: lowStockItems.map((row) => ({
        id: row.id,
        asset_definition_name: row.asset_definition_name,
        quantity_on_hand: row.quantity_on_hand,
        reorder_threshold: row.reorder_threshold,
      })),
      pending_inventory_requests: pendingRequests,
    };
  }

  private async recentEvents(actions: string[], since: Date, limit = 20) {
    const rows = await this.prisma.auditLog.findMany({
      where: { action: { in: actions }, createdAt: { gte: since } },
      orderBy: { createdAt: 'desc' },
      take: limit,
      include: { actor: { select: { displayName: true } } },
    });

    return rows.map((row) => ({
      id: row.id.toString(),
      actor_user_id: row.actorUserId,
      actor_display_name: row.actor?.displayName ?? null,
      action: row.action,
      target_type: row.targetType,
      target_id: row.targetId,
      ip_address: row.ipAddress,
      created_at: row.createdAt.toISOString(),
    }));
  }
}

function sinceDate(windowDays: number): Date {
  return new Date(Date.now() - windowDays * 24 * 60 * 60 * 1000);
}
