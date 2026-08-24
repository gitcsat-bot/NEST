import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { ApiExceptions } from '../common/dto/api-exception';
import { CreateAssetDefinitionDto } from './dto/create-asset-definition.dto';
import { UpdateAssetDefinitionDto } from './dto/update-asset-definition.dto';

@Injectable()
export class CatalogService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  async create(dto: CreateAssetDefinitionDto, actorId: string) {
    let item;
    try {
      item = await this.prisma.assetDefinition.create({
        data: {
          sku: dto.sku,
          name: dto.name,
          description: dto.description,
          manufacturer: dto.manufacturer,
        },
      });
    } catch (error: any) {
      if (error.code === 'P2002') {
        throw ApiExceptions.validation([{ field: 'sku', message: 'An item with this SKU already exists.' }]);
      }
      throw error;
    }

    await this.audit.record({
      actorUserId: actorId,
      action: 'catalog.created' as any,
      targetType: 'asset_definition',
      targetId: item.id,
      afterState: { sku: item.sku, name: item.name },
    });

    return this.toDto(item as any);
  }

  async findAll(filters: {
    search?: string;
    isConsumable?: boolean;
    page: number;
    pageSize: number;
  }) {
    const where: any = { deletedAt: null };

    if (filters.search) {
      where.OR = [
        { name: { contains: filters.search, mode: 'insensitive' } },
        { sku: { contains: filters.search, mode: 'insensitive' } },
        { manufacturer: { contains: filters.search, mode: 'insensitive' } },
      ];
    }

    if (filters.isConsumable !== undefined) {
      where.isConsumable = filters.isConsumable;
    }

    const [items, total] = await Promise.all([
      this.prisma.assetDefinition.findMany({
        where,
        skip: (filters.page - 1) * filters.pageSize,
        take: filters.pageSize,
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.assetDefinition.count({ where }),
    ]);

    return {
      items: items.map((i) => this.toDto(i as any)),
      total,
      page: filters.page,
      page_size: filters.pageSize,
    };
  }

  async findById(id: string) {
    const item = await this.prisma.assetDefinition.findUnique({ where: { id } });
    if (!item) throw ApiExceptions.notFound('AssetDefinition');
    return this.toDto(item as any);
  }

  async update(id: string, dto: UpdateAssetDefinitionDto, actorId: string) {
    const before = await this.prisma.assetDefinition.findUnique({ where: { id } });
    if (!before) throw ApiExceptions.notFound('AssetDefinition');

    const data: any = {};
    if (dto.name !== undefined) data.name = dto.name;
    if (dto.description !== undefined) data.description = dto.description;
    if (dto.manufacturer !== undefined) data.manufacturer = dto.manufacturer;
    if (dto.model_number !== undefined) data.modelNumber = dto.model_number;
    if (dto.is_consumable !== undefined) data.isConsumable = dto.is_consumable;
    if (dto.requires_return !== undefined) data.requiresReturn = dto.requires_return;

    const after = await this.prisma.assetDefinition.update({
      where: { id },
      data,
    });

    await this.audit.record({
      actorUserId: actorId,
      action: 'catalog.updated' as any,
      targetType: 'asset_definition',
      targetId: id,
      beforeState: this.toDto(before as any),
      afterState: this.toDto(after as any),
    });

    return this.toDto(after as any);
  }

  async remove(id: string, actorId: string) {
    const item = await this.prisma.assetDefinition.findUnique({ where: { id } });
    if (!item) throw ApiExceptions.notFound('AssetDefinition');

    await this.prisma.$transaction([
      this.prisma.assetDefinition.update({ where: { id }, data: { deletedAt: new Date() } }),
      this.prisma.catalogDeletionRequest.updateMany({
        where: { assetDefinitionId: id, status: 'pending' as any },
        data: { status: 'approved' as any, reviewedByUserId: actorId, reviewedAt: new Date() }
      })
    ]);

    await this.audit.record({
      actorUserId: actorId,
      action: 'catalog.deleted' as any,
      targetType: 'asset_definition',
      targetId: id,
      beforeState: this.toDto(item as any),
    });

    return { deleted: true };
  }

  private toDto(item: {
    id: string;
    sku: string;
    name: string;
    description: string | null;
    manufacturer: string | null;
    modelNumber: string | null;
    isConsumable: boolean;
    requiresReturn: boolean;
    createdAt: Date;
    updatedAt: Date;
  }) {
    return {
      id: item.id,
      sku: item.sku,
      name: item.name,
      description: item.description,
      manufacturer: item.manufacturer,
      model_number: item.modelNumber,
      is_consumable: item.isConsumable,
      requires_return: item.requiresReturn,
      created_at: item.createdAt.toISOString(),
      updated_at: item.updatedAt.toISOString(),
    };
  }
}
