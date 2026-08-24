import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { InventoryTransactionType } from '../../generated/prisma';

@Injectable()
export class InventoryService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll() {
    return this.prisma.inventoryItem.findMany({
      where: { deletedAt: null },
      include: { assetDefinition: true, location: true },
    });
  }

  async findOne(id: string) {
    const item = await this.prisma.inventoryItem.findUnique({
      where: { id },
      include: { assetDefinition: true, location: true, transactions: { orderBy: { createdAt: 'desc' }, take: 20 } },
    });
    if (!item || item.deletedAt) throw new NotFoundException('Inventory item not found');
    return item;
  }

  async receiveStock(id: string, quantity: number, userId: string, notes?: string, projectId?: string) {
    if (quantity <= 0) throw new BadRequestException('Quantity must be positive');

    return this.prisma.$transaction(async (tx) => {
      const item = await tx.inventoryItem.update({
        where: { id },
        data: {
          quantityOnHand: { increment: quantity },
          updatedAt: new Date(),
        },
      });

      await tx.inventoryTransaction.create({
        data: {
          inventoryItemId: id,
          type: InventoryTransactionType.receive,
          quantityDelta: quantity,
          reason: notes,
          projectId,
          actorUserId: userId,
        },
      });

      return item;
    });
  }

  async consumeStock(id: string, quantity: number, userId: string, notes?: string, projectId?: string) {
    if (quantity <= 0) throw new BadRequestException('Quantity must be positive');

    return this.prisma.$transaction(async (tx) => {
      const item = await tx.inventoryItem.findUnique({ where: { id } });
      if (!item) throw new NotFoundException('Item not found');
      if (item.quantityOnHand < quantity) throw new BadRequestException('Insufficient stock');

      const updated = await tx.inventoryItem.update({
        where: { id },
        data: {
          quantityOnHand: { decrement: quantity },
          updatedAt: new Date(),
        },
      });

      await tx.inventoryTransaction.create({
        data: {
          inventoryItemId: id,
          type: InventoryTransactionType.consume,
          quantityDelta: -quantity,
          reason: notes,
          projectId,
          actorUserId: userId,
        },
      });

      return updated;
    });
  }

  async adjustStock(id: string, newQuantity: number, userId: string, notes?: string) {
    if (newQuantity < 0) throw new BadRequestException('Quantity cannot be negative');

    return this.prisma.$transaction(async (tx) => {
      const item = await tx.inventoryItem.findUnique({ where: { id } });
      if (!item) throw new NotFoundException('Item not found');
      
      const delta = newQuantity - item.quantityOnHand;
      if (delta === 0) return item; // No change

      const updated = await tx.inventoryItem.update({
        where: { id },
        data: {
          quantityOnHand: newQuantity,
          updatedAt: new Date(),
        },
      });

      await tx.inventoryTransaction.create({
        data: {
          inventoryItemId: id,
          type: delta > 0 ? InventoryTransactionType.adjust : InventoryTransactionType.adjust,
          quantityDelta: delta,
          reason: notes,
          actorUserId: userId,
        },
      });

      return updated;
    });
  }

  async reconcile(id: string, actualQuantity: number, userId: string, notes?: string) {
    // Reconciliation is practically an adjustment but logged specifically
    return this.adjustStock(id, actualQuantity, userId, notes || 'Reconciliation');
  }
}
