import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { PolymorphicTargetType } from '../../generated/prisma';

@Injectable()
export class TransfersService {
  constructor(private readonly prisma: PrismaService) {}

  async transferAssetInstance(assetInstanceId: string, toLocationId: string, userId: string, reason?: string) {
    return this.prisma.$transaction(async (tx) => {
      const asset = await tx.assetInstance.findUnique({ where: { id: assetInstanceId } });
      if (!asset) throw new NotFoundException('Asset instance not found');

      if (asset.currentLocationId === toLocationId) {
        return asset; // Already there
      }

      const fromLocationId = asset.currentLocationId;

      const updatedAsset = await tx.assetInstance.update({
        where: { id: assetInstanceId },
        data: {
          currentLocationId: toLocationId,
          updatedAt: new Date(),
          updatedByUserId: userId,
        },
      });

      await tx.movementEvent.create({
        data: {
          targetType: PolymorphicTargetType.asset_instance,
          targetId: assetInstanceId,
          fromLocationId,
          toLocationId,
          movedByUserId: userId,
          reason,
        },
      });

      return updatedAsset;
    });
  }

  async transferInventory(inventoryItemId: string, toLocationId: string, quantity: number, userId: string, reason?: string) {
    return this.prisma.$transaction(async (tx) => {
      const item = await tx.inventoryItem.findUnique({ where: { id: inventoryItemId } });
      if (!item) throw new NotFoundException('Inventory item not found');

      if (item.locationId === toLocationId) {
        return item;
      }
      
      // For inventory, transferring means consuming from one and receiving to another
      // We check if destination inventory item already exists
      let destItem = await tx.inventoryItem.findUnique({
        where: {
          assetDefinitionId_locationId: {
            assetDefinitionId: item.assetDefinitionId,
            locationId: toLocationId,
          }
        }
      });

      if (!destItem) {
        destItem = await tx.inventoryItem.create({
          data: {
            assetDefinitionId: item.assetDefinitionId,
            locationId: toLocationId,
            unit: item.unit,
            quantityOnHand: 0,
          }
        });
      }

      // Decrement source
      await tx.inventoryItem.update({
        where: { id: item.id },
        data: { quantityOnHand: { decrement: quantity }, updatedAt: new Date() }
      });

      // Increment dest
      await tx.inventoryItem.update({
        where: { id: destItem.id },
        data: { quantityOnHand: { increment: quantity }, updatedAt: new Date() }
      });

      // Log movement event
      await tx.movementEvent.create({
        data: {
          targetType: PolymorphicTargetType.inventory_item,
          targetId: destItem.id, // Or could be a custom ID for the movement itself
          fromLocationId: item.locationId,
          toLocationId,
          movedByUserId: userId,
          reason,
        },
      });

      return destItem;
    });
  }
}
