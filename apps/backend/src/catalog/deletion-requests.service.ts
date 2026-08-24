import { Injectable } from '@nestjs/common';
import { InventoryRequestStatus } from '@nest/shared-types';
import { CatalogDeletionRequestStatus } from '../../generated/prisma';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { ApiExceptions } from '../common/dto/api-exception';
import { CreateDeletionRequestDto } from './dto/create-deletion-request.dto';

// Rewritten to use Prisma delegate API instead of raw SQL.
// The catalog_deletion_requests table uses CatalogDeletionRequestStatus
// (pending/approved/rejected), NOT the old InventoryRequestStatus type.

interface RequestContext {
  ipAddress: string;
  userAgent: string;
}

// Map legacy InventoryRequestStatus enum to CatalogDeletionRequestStatus for API compat
function toPrismaStatus(status?: InventoryRequestStatus): CatalogDeletionRequestStatus | undefined {
  if (!status) return undefined;
  const map: Record<string, CatalogDeletionRequestStatus> = {
    PENDING: CatalogDeletionRequestStatus.pending,
    APPROVED: CatalogDeletionRequestStatus.approved,
    REJECTED: CatalogDeletionRequestStatus.rejected,
  };
  return map[status];
}

@Injectable()
export class CatalogDeletionRequestsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  async create(
    assetDefinitionId: string,
    dto: CreateDeletionRequestDto,
    actorId: string,
    ctx: RequestContext,
  ) {
    const assetDefinition = await this.prisma.assetDefinition.findUnique({
      where: { id: assetDefinitionId },
    });
    if (!assetDefinition) throw ApiExceptions.notFound('AssetDefinition');

    // Check for existing pending request
    const existingPending = await this.prisma.catalogDeletionRequest.findFirst({
      where: { assetDefinitionId, status: CatalogDeletionRequestStatus.pending },
    });
    if (existingPending) {
      throw ApiExceptions.conflict(
        'VALIDATION_ERROR',
        'A deletion request for this item is already pending admin review.',
      );
    }

    const created = await this.prisma.catalogDeletionRequest.create({
      data: {
        assetDefinitionId,
        requestedByUserId: actorId,
        reason: dto.reason ?? null,
        status: CatalogDeletionRequestStatus.pending,
      },
      include: {
        assetDefinition: true,
        requestedBy: { select: { displayName: true } },
        reviewedBy: { select: { displayName: true } },
      },
    });

    await this.audit.record({
      actorUserId: actorId,
      action: 'catalog.deletion_requested' as any,
      targetType: 'asset_definition',
      targetId: assetDefinitionId,
      afterState: { deletion_request_id: created.id, reason: dto.reason ?? null },
      ipAddress: ctx.ipAddress,
      userAgent: ctx.userAgent,
    });

    return this.toDto(created);
  }

  async list(filters: { status?: InventoryRequestStatus; page: number; pageSize: number }) {
    const where: any = {};
    const prismaStatus = toPrismaStatus(filters.status);
    if (prismaStatus) where.status = prismaStatus;
    
    // Do not show requests for items that have already been deleted
    where.assetDefinition = { deletedAt: null };

    const [items, total] = await Promise.all([
      this.prisma.catalogDeletionRequest.findMany({
        where,
        include: {
          assetDefinition: true,
          requestedBy: { select: { displayName: true } },
          reviewedBy: { select: { displayName: true } },
        },
        orderBy: { createdAt: 'desc' },
        skip: (filters.page - 1) * filters.pageSize,
        take: filters.pageSize,
      }),
      this.prisma.catalogDeletionRequest.count({ where }),
    ]);

    return {
      items: items.map((r) => this.toDto(r)),
      total,
      page: filters.page,
      page_size: filters.pageSize,
    };
  }

  async review(id: string, decision: 'approved' | 'rejected', actorId: string, ctx: RequestContext) {
    const request = await this.prisma.catalogDeletionRequest.findUnique({
      where: { id },
    });
    if (!request) throw ApiExceptions.notFound('CatalogDeletionRequest');
    if (request.status !== CatalogDeletionRequestStatus.pending) {
      throw ApiExceptions.conflict('VALIDATION_ERROR', `This request has already been ${request.status}.`);
    }

    const newStatus = decision === 'approved'
      ? CatalogDeletionRequestStatus.approved
      : CatalogDeletionRequestStatus.rejected;

    try {
      await this.prisma.$transaction(async (tx) => {
          if (decision === 'approved') {
            await tx.inventoryItem.updateMany({
              where: { assetDefinitionId: request.assetDefinitionId },
              data: { deletedAt: new Date() },
            });
            await tx.assetInstance.updateMany({
              where: { assetDefinitionId: request.assetDefinitionId },
              data: { deletedAt: new Date() },
            });
            await tx.assetDefinition.update({
              where: { id: request.assetDefinitionId },
              data: { deletedAt: new Date() },
            });
          }
        await tx.catalogDeletionRequest.update({
          where: { id },
          data: {
            status: newStatus,
            reviewedByUserId: actorId,
            reviewedAt: new Date(),
          },
        });
      });
    } catch (err: any) {
      if (decision === 'approved' && (err?.code === 'P2003' || err?.code === 'P2014')) {
        throw ApiExceptions.conflict(
          'VALIDATION_ERROR',
          'This item still has related records that could not be removed. Please contact an administrator.',
        );
      }
      throw err;
    }

    await this.audit.record({
      actorUserId: actorId,
      action: decision === 'approved' ? 'catalog.deletion_approved' as any : 'catalog.deletion_rejected' as any,
      targetType: 'asset_definition',
      targetId: request.assetDefinitionId,
      beforeState: { deletion_request_id: id, status: 'pending' },
      afterState: { status: decision },
      ipAddress: ctx.ipAddress,
      userAgent: ctx.userAgent,
    });

    if (decision === 'approved') return { deleted: true, request_id: id };

    const updated = await this.prisma.catalogDeletionRequest.findUnique({
      where: { id },
      include: {
        assetDefinition: true,
        requestedBy: { select: { displayName: true } },
        reviewedBy: { select: { displayName: true } },
      },
    });
    return this.toDto(updated!);
  }

  private toDto(row: any) {
    return {
      id: row.id,
      asset_definition_id: row.assetDefinitionId,
      asset_definition_name: row.assetDefinition?.name ?? null,
      asset_definition_sku: row.assetDefinition?.sku ?? null,
      requested_by_user_id: row.requestedByUserId,
      requested_by_display_name: row.requestedBy?.displayName ?? null,
      reason: row.reason,
      status: row.status,
      reviewed_by_user_id: row.reviewedByUserId ?? null,
      reviewed_by_display_name: row.reviewedBy?.displayName ?? null,
      reviewed_at: row.reviewedAt?.toISOString() ?? null,
      created_at: row.createdAt.toISOString(),
    };
  }
}
