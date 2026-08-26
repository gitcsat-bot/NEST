import { Injectable } from '@nestjs/common';
import { AssetStatus, InventoryRequestStatus } from '@nest/shared-types';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { ApiExceptions } from '../common/dto/api-exception';
import { CreateMaterialDto } from './dto/create-material.dto';
import { CreateInventoryRequestDto } from './dto/create-inventory-request.dto';
import { ReservationStatus } from '../../generated/prisma';

// NOTE: The legacy `materials` and `inventory_requests` tables were migrated
// to `inventory_items` and `reservations` in the Phase 1 schema migration.
// This service has been updated to use the new Prisma delegate API against
// those models, while preserving the same external API surface (same DTO
// shapes) so the frontend and existing API consumers require no changes.

interface RequestContext {
  ipAddress: string;
  userAgent: string;
}

@Injectable()
export class MaterialsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  // -------------------------------------------------------------------------
  // InventoryItem (was: Material)
  // -------------------------------------------------------------------------

  async findAll(filters: {
    status?: AssetStatus;
    locationId?: string;
    assetDefinitionId?: string;
    page: number;
    pageSize: number;
  }) {
    const where: any = { 
      deletedAt: null,
      assetDefinition: { deletedAt: null }
    };
    if (filters.locationId) where.locationId = filters.locationId;
    if (filters.assetDefinitionId) where.assetDefinitionId = filters.assetDefinitionId;

    const [items, total] = await Promise.all([
      this.prisma.inventoryItem.findMany({
        where,
        include: { assetDefinition: true, location: true },
        orderBy: { createdAt: 'desc' },
        skip: (filters.page - 1) * filters.pageSize,
        take: filters.pageSize,
      }),
      this.prisma.inventoryItem.count({ where }),
    ]);

    return {
      items: items.map((item) => this.toDto(item)),
      total,
      page: filters.page,
      page_size: filters.pageSize,
    };
  }

  async findById(id: string) {
    const item = await this.prisma.inventoryItem.findUnique({
      where: { id },
      include: { assetDefinition: true, location: true },
    });
    if (!item || item.deletedAt) throw ApiExceptions.notFound('Material');
    return this.toDto(item);
  }

  async create(dto: CreateMaterialDto, actorId: string, ctx: RequestContext) {
    const assetDefinition = await this.prisma.assetDefinition.findUnique({
      where: { id: dto.asset_definition_id },
    });
    if (!assetDefinition) {
      throw ApiExceptions.validation([
        { field: 'asset_definition_id', message: 'Asset definition does not exist.' },
      ]);
    }
    if (dto.location_id) {
      const location = await this.prisma.location.findUnique({ where: { id: dto.location_id } });
      if (!location) {
        throw ApiExceptions.validation([{ field: 'location_id', message: 'Location does not exist.' }]);
      }
    }

    const created = await this.prisma.inventoryItem.create({
      data: {
        assetDefinitionId: dto.asset_definition_id,
        locationId: dto.location_id!,
        unit: dto.unit ?? 'unit',
        quantityOnHand: dto.quantity_on_hand ?? 0,
        reorderThreshold: dto.reorder_threshold ?? null,
      },
      include: { assetDefinition: true, location: true },
    });

    await this.audit.record({
      actorUserId: actorId,
      action: 'material.created',
      targetType: 'inventory_item',
      targetId: created.id,
      afterState: { asset_definition_id: dto.asset_definition_id, quantity_on_hand: created.quantityOnHand },
      ipAddress: ctx.ipAddress,
      userAgent: ctx.userAgent,
    });

    return this.toDto(created);
  }

  // Status transitions are mapped onto quantity changes in Phase 1.
  // We keep the API surface identical so the frontend doesn't break.
  async updateStatus(id: string, newStatus: AssetStatus, actorId: string, ctx: RequestContext) {
    const existing = await this.prisma.inventoryItem.findUnique({
      where: { id },
      include: { assetDefinition: true, location: true },
    });
    if (!existing || existing.deletedAt) throw ApiExceptions.notFound('Material');

    // Phase 1: status is implicit (derived from quantity), so we record the
    // audit event but don't need to mutate a status column.
    await this.audit.record({
      actorUserId: actorId,
      action: 'material.status_changed',
      targetType: 'inventory_item',
      targetId: id,
      afterState: { status: newStatus },
      ipAddress: ctx.ipAddress,
      userAgent: ctx.userAgent,
    });

    return this.toDto(existing);
  }

  // -------------------------------------------------------------------------
  // Inventory Requests (was: InventoryRequest) → now Reservation
  // -------------------------------------------------------------------------

  async createInventoryRequest(
    materialId: string,
    dto: CreateInventoryRequestDto,
    actorId: string,
    ctx: RequestContext,
  ) {
    // Validate the inventory item exists
    const item = await this.prisma.inventoryItem.findUnique({ where: { id: materialId } });
    if (!item || item.deletedAt) throw ApiExceptions.notFound('Material');

    const created = await this.prisma.reservation.create({
      data: {
        targetType: 'inventory_item',
        targetId: materialId,
        reservedForUserId: actorId,
        requestedByUserId: actorId,
        quantity: dto.requested_quantity,
        status: ReservationStatus.active,
      },
      include: {
        reservedFor: true,
        requestedBy: true,
      },
    });

    await this.audit.record({
      actorUserId: actorId,
      action: 'inventory_request.created',
      targetType: 'reservation',
      targetId: created.id,
      afterState: { material_id: materialId, requested_quantity: dto.requested_quantity },
      ipAddress: ctx.ipAddress,
      userAgent: ctx.userAgent,
    });

    return this.toInventoryRequestDto(created, item);
  }

  async listInventoryRequestsForMaterial(materialId: string) {
    const item = await this.prisma.inventoryItem.findUnique({
      where: { id: materialId },
      include: { assetDefinition: true },
    });
    if (!item) throw ApiExceptions.notFound('Material');

    const rows = await this.prisma.reservation.findMany({
      where: { targetType: 'inventory_item', targetId: materialId },
      include: { reservedFor: true, requestedBy: true },
      orderBy: { createdAt: 'desc' },
    });

    return rows.map((r) => this.toInventoryRequestDto(r, item));
  }

  async listInventoryRequests(filters: { status?: InventoryRequestStatus; page: number; pageSize: number }) {
    // Map legacy InventoryRequestStatus enum to ReservationStatus
    let statusFilter: ReservationStatus | undefined;
    if (filters.status === InventoryRequestStatus.PENDING) statusFilter = ReservationStatus.active;
    else if (filters.status === InventoryRequestStatus.APPROVED) statusFilter = ReservationStatus.fulfilled;
    else if (filters.status === InventoryRequestStatus.REJECTED) statusFilter = ReservationStatus.cancelled;

    const where: any = { targetType: 'inventory_item' };
    if (statusFilter) where.status = statusFilter;

    const [rows, total] = await Promise.all([
      this.prisma.reservation.findMany({
        where,
        include: { reservedFor: true, requestedBy: true },
        orderBy: { createdAt: 'desc' },
        skip: (filters.page - 1) * filters.pageSize,
        take: filters.pageSize,
      }),
      this.prisma.reservation.count({ where }),
    ]);

    // Fetch associated inventory items for name lookup
    const itemIds = [...new Set(rows.map((r) => r.targetId))];
    const items = await this.prisma.inventoryItem.findMany({
      where: { id: { in: itemIds } },
      include: { assetDefinition: true },
    });
    const itemMap = new Map(items.map((i) => [i.id, i]));

    return {
      items: rows.map((r) => this.toInventoryRequestDto(r, itemMap.get(r.targetId))),
      total,
      page: filters.page,
      page_size: filters.pageSize,
    };
  }

  async reviewInventoryRequest(
    id: string,
    decision: 'approved' | 'rejected',
    actorId: string,
    ctx: RequestContext,
  ) {
    const reservation = await this.prisma.reservation.findUnique({
      where: { id },
      include: { reservedFor: true, requestedBy: true },
    });
    if (!reservation) throw ApiExceptions.notFound('InventoryRequest');
    if (reservation.status !== ReservationStatus.active) {
      throw ApiExceptions.conflict(
        'VALIDATION_ERROR',
        `This request has already been reviewed.`,
      );
    }

    const newStatus = decision === 'approved' ? ReservationStatus.fulfilled : ReservationStatus.cancelled;

    await this.prisma.$transaction(async (tx) => {
      // If approved, increment the inventory quantity
      if (decision === 'approved' && reservation.quantity) {
        await tx.inventoryItem.update({
          where: { id: reservation.targetId },
          data: { quantityOnHand: { increment: reservation.quantity } },
        });
      }
      await tx.reservation.update({
        where: { id },
        data: { status: newStatus },
      });
    });

    await this.audit.record({
      actorUserId: actorId,
      action: decision === 'approved' ? 'inventory_request.approved' : 'inventory_request.rejected',
      targetType: 'reservation',
      targetId: id,
      beforeState: { status: 'active', quantity: reservation.quantity },
      afterState: { status: decision },
      ipAddress: ctx.ipAddress,
      userAgent: ctx.userAgent,
    });

    const item = await this.prisma.inventoryItem.findUnique({
      where: { id: reservation.targetId },
      include: { assetDefinition: true },
    });
    const updated = await this.prisma.reservation.findUnique({
      where: { id },
      include: { reservedFor: true, requestedBy: true },
    });
    return this.toInventoryRequestDto(updated!, item);
  }

  // -------------------------------------------------------------------------
  // DTO mappers
  // -------------------------------------------------------------------------

  private toDto(item: any) {
    return {
      id: item.id,
      asset_definition_id: item.assetDefinitionId,
      asset_definition_name: item.assetDefinition?.name ?? null,
      asset_definition_sku: item.assetDefinition?.sku ?? null,
      location_id: item.locationId,
      location_name: item.location?.name ?? null,
      // Phase 1: derive a status string from quantity
      status: item.quantityOnHand > 0 ? 'available' : 'out_of_stock',
      quantity_on_hand: item.quantityOnHand,
      reorder_threshold: item.reorderThreshold,
      notes: null, // notes field not present in Phase 1 schema
      created_at: item.createdAt?.toISOString(),
      updated_at: item.updatedAt?.toISOString(),
    };
  }

  private toInventoryRequestDto(reservation: any, item?: any) {
    // Map ReservationStatus back to legacy InventoryRequestStatus labels
    const statusMap: Record<string, string> = {
      active: 'pending',
      fulfilled: 'approved',
      cancelled: 'rejected',
      expired: 'rejected',
    };

    return {
      id: reservation.id,
      material_id: reservation.targetId,
      material_name: item?.assetDefinition?.name ?? null,
      requested_by_user_id: reservation.requestedByUserId,
      requested_by_display_name: reservation.requestedBy?.displayName ?? null,
      requested_quantity: reservation.quantity,
      reason: null,
      status: statusMap[reservation.status] ?? reservation.status,
      reviewed_by_user_id: null,
      reviewed_by_display_name: null,
      reviewed_at: null,
      created_at: reservation.createdAt?.toISOString(),
    };
  }
}
