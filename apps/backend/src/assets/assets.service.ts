import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AssetStatus, RelationshipType } from '../../generated/prisma';

@Injectable()
export class AssetsService {
  constructor(private readonly prisma: PrismaService) {}

  async create(data: any, userId: string) {
    // Generate a unique display code (e.g., AST-000001)
    const count = await this.prisma.assetInstance.count();
    const displayCode = `AST-${(count + 1).toString().padStart(6, '0')}`;

    return this.prisma.assetInstance.create({
      data: {
        ...data,
        displayCode,
        createdByUserId: userId,
        updatedByUserId: userId,
      },
    });
  }

  async findAll() {
    return this.prisma.assetInstance.findMany({
      where: { deletedAt: null },
      include: { assetDefinition: true, currentLocation: true, currentHolder: true },
    });
  }

  async findOne(id: string) {
    const asset = await this.prisma.assetInstance.findUnique({
      where: { id },
      include: { 
        assetDefinition: true, 
        currentLocation: true, 
        currentHolder: true,
        parentRelationships: { include: { childAsset: true } },
        childRelationships: { include: { parentAsset: true } },
      },
    });
    if (!asset || asset.deletedAt) throw new NotFoundException('Asset not found');
    return asset;
  }

  async update(id: string, data: any, userId: string) {
    await this.findOne(id); // validates existence, throws NotFoundException if missing
    return this.prisma.assetInstance.update({
      where: { id },
      data: { ...data, updatedByUserId: userId },
    });
  }

  async transitionStatus(id: string, newStatus: AssetStatus, userId: string, notes?: string) {
    const asset = await this.findOne(id);
    
    // Status machine logic
    // For MVP, we will allow transitions if they make sense
    // Typically verified against a state machine definition
    
    // Perform update
    return this.prisma.assetInstance.update({
      where: { id },
      data: {
        status: newStatus,
        conditionNote: notes ? notes : asset.conditionNote,
        updatedByUserId: userId,
      },
    });
  }

  async delete(id: string, userId: string) {
    await this.findOne(id); // validates existence, throws NotFoundException if missing
    return this.prisma.assetInstance.update({
      where: { id },
      data: {
        deletedAt: new Date(),
        updatedByUserId: userId,
      },
    });
  }

  // Asset Relationships
  async addRelationship(parentId: string, childId: string, type: RelationshipType, userId: string) {
    if (parentId === childId) throw new BadRequestException('Cannot relate asset to itself');
    
    return this.prisma.assetRelationship.create({
      data: {
        parentAssetId: parentId,
        childAssetId: childId,
        relationshipType: type,
        createdByUserId: userId,
      }
    });
  }

  async removeRelationship(parentId: string, childId: string, type: RelationshipType) {
    const rel = await this.prisma.assetRelationship.findUnique({
      where: {
        parentAssetId_childAssetId_relationshipType: {
          parentAssetId: parentId,
          childAssetId: childId,
          relationshipType: type,
        }
      }
    });
    if (!rel) throw new NotFoundException('Relationship not found');
    
    return this.prisma.assetRelationship.delete({
      where: { id: rel.id }
    });
  }
}
