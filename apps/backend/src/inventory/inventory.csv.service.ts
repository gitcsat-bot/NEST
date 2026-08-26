import { Injectable, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import * as Papa from 'papaparse';

@Injectable()
export class InventoryCsvService {
  constructor(private prisma: PrismaService) {}

  generateTemplate() {
    const csv = Papa.unparse([
      {
        sku: 'PART-001',
        name: '10k Resistor',
        category: 'Electronics',
        location: 'Main Warehouse',
        quantity: 100,
        unit: 'pcs',
      }
    ]);
    return csv;
  }

  async processCsv(csvContent: string, userId: string) {
    const parsed = Papa.parse(csvContent, { header: true, skipEmptyLines: true });
    
    if (parsed.errors.length > 0) {
      throw new BadRequestException('Invalid CSV format: ' + parsed.errors.map(e => e.message).join(', '));
    }

    let processedCount = 0;

    for (const row of parsed.data as any[]) {
      if (!row.sku || !row.name || !row.location || !row.quantity) {
        continue;
      }

      await this.prisma.$transaction(async (tx) => {
        let assetDef = await tx.assetDefinition.findUnique({ where: { sku: row.sku } });
        if (!assetDef) {
          assetDef = await tx.assetDefinition.create({
            data: {
              sku: row.sku,
              name: row.name,
              category: row.category || 'Uncategorized',
            }
          });
        } else {
          if (assetDef.name !== row.name || (row.category && assetDef.category !== row.category)) {
            assetDef = await tx.assetDefinition.update({
              where: { id: assetDef.id },
              data: {
                name: row.name,
                category: row.category || assetDef.category,
              }
            });
          }
        }

        const locName = row.location.trim();
        let location = await tx.location.findFirst({ where: { name: locName } });
        if (!location) {
          location = await tx.location.create({
            data: {
              name: locName,
              type: 'other',
            }
          });
        }

        const quantity = parseInt(row.quantity, 10);
        const unit = row.unit || 'pcs';

        let inventoryItem = await tx.inventoryItem.findUnique({
          where: {
            assetDefinitionId_locationId: {
              assetDefinitionId: assetDef.id,
              locationId: location.id,
            }
          }
        });

        if (inventoryItem) {
          const delta = quantity - inventoryItem.quantityOnHand;
          if (delta !== 0) {
            inventoryItem = await tx.inventoryItem.update({
              where: { id: inventoryItem.id },
              data: { quantityOnHand: quantity, unit }
            });
            await tx.inventoryTransaction.create({
              data: {
                inventoryItemId: inventoryItem.id,
                type: 'adjust',
                quantityDelta: delta,
                reason: 'CSV Bulk Import',
                actorUserId: userId,
              }
            });
          }
        } else {
          inventoryItem = await tx.inventoryItem.create({
            data: {
              assetDefinitionId: assetDef.id,
              locationId: location.id,
              quantityOnHand: quantity,
              unit,
            }
          });
          await tx.inventoryTransaction.create({
            data: {
              inventoryItemId: inventoryItem.id,
              type: 'receive',
              quantityDelta: quantity,
              reason: 'CSV Bulk Import Initial',
              actorUserId: userId,
            }
          });
        }
      });
      processedCount++;
    }

    return { message: `Successfully processed ${processedCount} inventory items.` };
  }
}
