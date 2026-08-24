import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { UserRole } from '@nest/shared-types';
import { ReservationStatus, UserRole as PrismaUserRole } from '../../generated/prisma';

@Injectable()
export class DashboardService {
  constructor(private readonly prisma: PrismaService) {}

  async getDashboardMetrics(userRole: UserRole, userId: string) {
    switch (userRole) {
      case UserRole.ADMIN:
      case UserRole.STORES_MANAGER:
        return this.getAdminMetrics();
      case UserRole.STUDENT:
      case UserRole.CONTRIBUTOR:
        return this.getStudentMetrics(userId);
      case UserRole.VIEWER:
      default:
        return this.getViewerMetrics();
    }
  }

  private async getAdminMetrics() {
    // Low stock items: quantity_on_hand <= reorder_threshold
    const lowInventoryItems = await this.prisma.$queryRaw`
      SELECT ii.id, ad.name, ii.quantity_on_hand, ii.reorder_threshold, l.name as location_name
      FROM inventory_items ii
      JOIN asset_definitions ad ON ad.id = ii.asset_definition_id
      JOIN locations l ON l.id = ii.location_id
      WHERE ii.reorder_threshold IS NOT NULL
        AND ii.quantity_on_hand <= ii.reorder_threshold
        AND ii.deleted_at IS NULL
      LIMIT 10;
    `;

    const [userCount, activeUserCount, locations] = await Promise.all([
      this.prisma.user.count(),
      this.prisma.user.count({ where: { isActive: true } }),
      this.prisma.location.findMany({ where: { isActive: true }, take: 20, select: { id: true, name: true } }),
    ]);

    return {
      role: 'admin',
      lowInventoryItems,
      users: {
        total: userCount,
        active: activeUserCount,
        inactive: userCount - activeUserCount,
      },
      locations,
    };
  }

  private async getStudentMetrics(userId: string) {
    const [itemsStatusCounts, locations, requestsSummary, admins] = await Promise.all([
      this.prisma.assetInstance.groupBy({ by: ['status'], _count: true }),
      this.prisma.location.findMany({ where: { isActive: true }, take: 20, select: { id: true, name: true } }),
      Promise.all([
        this.prisma.reservation.count({ where: { requestedByUserId: userId, status: ReservationStatus.active } }),
        this.prisma.reservation.count({ where: { requestedByUserId: userId, status: ReservationStatus.fulfilled } }),
        this.prisma.reservation.count({ where: { requestedByUserId: userId, status: ReservationStatus.cancelled } }),
      ]),
      this.prisma.user.findMany({
        where: { role: PrismaUserRole.admin, isActive: true },
        select: { displayName: true, email: true },
      }),
    ]);

    return {
      role: 'student',
      itemsStatus: itemsStatusCounts.map(i => ({ status: i.status, count: i._count })),
      locations,
      requests: {
        sent: requestsSummary[0],
        approved: requestsSummary[1],
        rejected: requestsSummary[2],
      },
      adminContacts: admins,
    };
  }

  private async getViewerMetrics() {
    const [locations, admins] = await Promise.all([
      this.prisma.location.findMany({ where: { isActive: true }, take: 20, select: { id: true, name: true } }),
      this.prisma.user.findMany({
        where: { role: PrismaUserRole.admin, isActive: true },
        select: { displayName: true, email: true },
      }),
    ]);

    return {
      role: 'viewer',
      locations,
      adminContacts: admins,
    };
  }
}
