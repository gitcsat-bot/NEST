import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { ApiExceptions } from '../common/dto/api-exception';
import { LocationDto } from '@nest/shared-types';
import { CreateLocationDto } from './dto/create-location.dto';
import { UpdateLocationDto } from './dto/update-location.dto';
import { LocationQueryDto } from './dto/location-query.dto';

interface RequestContext {
  ipAddress: string;
  userAgent: string;
}

@Injectable()
export class LocationsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  async findAll(query: LocationQueryDto): Promise<LocationDto[]> {
    const where: any = {};
    if (query.parent_id !== undefined) {
      where.parentLocationId = query.parent_id === 'null' ? null : query.parent_id;
    }
    if (query.is_active !== undefined) {
      where.isActive = query.is_active;
    }

    const locations = await this.prisma.location.findMany({
      where,
      orderBy: { name: 'asc' },
    });

    return locations.map((loc) => this.mapToDto(loc));
  }

  async findOne(id: string): Promise<LocationDto> {
    const location = await this.prisma.location.findUnique({
      where: { id },
    });

    if (!location) {
      throw ApiExceptions.notFound('Location');
    }

    const breadcrumb = await this.buildBreadcrumb(location.id);
    return this.mapToDto(location, breadcrumb);
  }

  async create(
    dto: CreateLocationDto,
    actorUserId: string,
    ctx: RequestContext,
  ): Promise<LocationDto> {
    if (dto.parent_location_id) {
      const parent = await this.prisma.location.findUnique({
        where: { id: dto.parent_location_id },
      });
      if (!parent) {
        throw ApiExceptions.validation([
          { field: 'parent_location_id', message: 'Parent location does not exist.' },
        ]);
      }
    }

    const location = await this.prisma.location.create({
      data: {
        name: dto.name,
        type: dto.type,
        parentLocationId: dto.parent_location_id ?? null,
        description: dto.description ?? null,
      },
    });

    await this.audit.record({
      actorUserId,
      action: 'location.created',
      targetType: 'location',
      targetId: location.id,
      afterState: { name: location.name, type: location.type, parentLocationId: location.parentLocationId },
      ipAddress: ctx.ipAddress,
      userAgent: ctx.userAgent,
    });

    const breadcrumb = await this.buildBreadcrumb(location.id);
    return this.mapToDto(location, breadcrumb);
  }

  async update(
    id: string,
    dto: UpdateLocationDto,
    actorUserId: string,
    ctx: RequestContext,
  ): Promise<LocationDto> {
    const existing = await this.prisma.location.findUnique({
      where: { id },
    });
    if (!existing) {
      throw ApiExceptions.notFound('Location');
    }

    // Cycle prevention check
    if (dto.parent_location_id !== undefined && dto.parent_location_id !== existing.parentLocationId) {
      if (dto.parent_location_id === id) {
        throw ApiExceptions.conflict('LOCATION_CYCLE', 'A location cannot be its own parent.');
      }
      if (dto.parent_location_id !== null) {
        const isCycle = await this.detectCycle(id, dto.parent_location_id);
        if (isCycle) {
          throw ApiExceptions.conflict(
            'LOCATION_CYCLE',
            'Cannot set parent location as it would create a circular dependency.',
          );
        }
      }
    }

    const updated = await this.prisma.location.update({
      where: { id },
      data: {
        ...(dto.name !== undefined && { name: dto.name }),
        ...(dto.type !== undefined && { type: dto.type }),
        ...(dto.parent_location_id !== undefined && { parentLocationId: dto.parent_location_id }),
        ...(dto.description !== undefined && { description: dto.description }),
      },
    });

    await this.audit.record({
      actorUserId,
      action: 'location.updated',
      targetType: 'location',
      targetId: updated.id,
      beforeState: { name: existing.name, type: existing.type, parentLocationId: existing.parentLocationId },
      afterState: { name: updated.name, type: updated.type, parentLocationId: updated.parentLocationId },
      ipAddress: ctx.ipAddress,
      userAgent: ctx.userAgent,
    });

    const breadcrumb = await this.buildBreadcrumb(updated.id);
    return this.mapToDto(updated, breadcrumb);
  }

  async updateStatus(
    id: string,
    status: any,
    actorUserId: string,
    ctx: RequestContext,
  ): Promise<LocationDto> {
    const existing = await this.prisma.location.findUnique({
      where: { id },
    });
    if (!existing) {
      throw ApiExceptions.notFound('Location');
    }

    const updated = await this.prisma.location.update({
      where: { id },
      data: { status },
    });

    await this.audit.record({
      actorUserId,
      action: 'location.status_updated',
      targetType: 'location',
      targetId: updated.id,
      beforeState: { status: existing.status },
      afterState: { status: updated.status },
      ipAddress: ctx.ipAddress,
      userAgent: ctx.userAgent,
    });

    const breadcrumb = await this.buildBreadcrumb(updated.id);
    return this.mapToDto(updated, breadcrumb);
  }

  async archive(
    id: string,
    actorUserId: string,
    ctx: RequestContext,
  ): Promise<LocationDto> {
    const location = await this.prisma.location.findUnique({
      where: { id },
      include: {
        childLocations: {
          where: { isActive: true },
        },
      },
    });

    if (!location) {
      throw ApiExceptions.notFound('Location');
    }

    if (location.childLocations.length > 0) {
      throw ApiExceptions.conflict(
        'VALIDATION_ERROR',
        'Cannot archive location with active child locations.',
      );
    }

    const archived = await this.prisma.location.update({
      where: { id },
      data: { isActive: false },
    });

    await this.audit.record({
      actorUserId,
      action: 'location.archived',
      targetType: 'location',
      targetId: archived.id,
      beforeState: { isActive: true },
      afterState: { isActive: false },
      ipAddress: ctx.ipAddress,
      userAgent: ctx.userAgent,
    });

    const breadcrumb = await this.buildBreadcrumb(archived.id);
    return this.mapToDto(archived, breadcrumb);
  }

  private async detectCycle(targetId: string, proposedParentId: string): Promise<boolean> {
    let currentId: string | null = proposedParentId;
    const visited = new Set<string>();

    while (currentId) {
      if (currentId === targetId) {
        return true;
      }
      if (visited.has(currentId)) {
        return true;
      }
      visited.add(currentId);

      const parentNode: { parentLocationId: string | null } | null = await this.prisma.location.findUnique({
        where: { id: currentId },
        select: { parentLocationId: true },
      });

      currentId = parentNode?.parentLocationId ?? null;
    }

    return false;
  }

  private async buildBreadcrumb(id: string): Promise<string[]> {
    const chain: string[] = [];
    let currentId: string | null = id;
    const visited = new Set<string>();

    while (currentId) {
      if (visited.has(currentId)) break;
      visited.add(currentId);

      const loc: { id: string; name: string; parentLocationId: string | null } | null =
        await this.prisma.location.findUnique({
          where: { id: currentId },
          select: { id: true, name: true, parentLocationId: true },
        });

      if (!loc) break;
      chain.unshift(loc.name);
      currentId = loc.parentLocationId;
    }

    return chain;
  }

  private mapToDto(location: any, breadcrumb?: string[]): LocationDto {
    return {
      id: location.id,
      name: location.name,
      type: location.type,
      status: location.status,
      parent_location_id: location.parentLocationId,
      description: location.description ?? null,
      is_active: location.isActive,
      breadcrumb,
      created_at: location.createdAt?.toISOString?.() ?? location.createdAt,
      updated_at: location.updatedAt?.toISOString?.() ?? location.updatedAt,
    };
  }
}
