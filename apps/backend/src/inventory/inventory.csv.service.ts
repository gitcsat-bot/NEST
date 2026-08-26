import { Injectable, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import * as Papa from 'papaparse';

@Injectable()
export class InventoryCsvService {
  constructor(private prisma: PrismaService) {}

  generateTemplate() {
    const csv = Papa.unparse([
      {
        'SKU [Required]': 'PART-001',
        'Name [Required]': '10k Resistor',
        'Manufacturer [Optional]': 'Acme Corp',
        'Model No [Optional]': '10K-RES',
        'Description [Optional]': 'A standard 10k resistor',
        'Location [Required]': 'Main Warehouse',
        'Quantity [Required]': 100,
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
    
    // Mitigate CSV/Formula Injection by stripping leading formula characters
    const sanitizeField = (val: any) => {
      if (typeof val === 'string') {
        if (/^[=+\-@]/.test(val)) {
          return "'" + val; // Prefix with single quote so Excel treats it as text
        }
        return val;
      }
      return val;
    };

    for (const rawRow of parsed.data as any[]) {
      const row: any = {};
      for (const key of Object.keys(rawRow)) {
        const normalizedKey = key.toLowerCase().replace(/\[.*?\]/g, '').trim().replace(/\s+/g, '_');
        row[normalizedKey] = sanitizeField(rawRow[key]);
      }

      const sku = row.sku || row.part_number;
      const name = row.name;
      const locationName = row.location;
      const quantityStr = row.quantity || row.number_of_pieces;

      if (!sku || !name || !locationName || !quantityStr) {
        console.log('Skipping row due to missing required fields:', { sku, name, locationName, quantityStr, rawRow });
        continue;
      }

      await this.prisma.$transaction(async (tx) => {
        let assetDef = await tx.assetDefinition.findUnique({ where: { sku } });
        if (!assetDef) {
          assetDef = await tx.assetDefinition.create({
            data: {
              sku,
              name,
              category: 'Uncategorized',
              manufacturer: row.manufacturer,
              description: row.description,
              modelNumber: row.model_no || row.model_number,
            }
          });
        } else {
          if (assetDef.name !== name || assetDef.deletedAt !== null) {
            assetDef = await tx.assetDefinition.update({
              where: { id: assetDef.id },
              data: {
                name,
                manufacturer: row.manufacturer || assetDef.manufacturer,
                description: row.description || assetDef.description,
                modelNumber: row.model_no || row.model_number || assetDef.modelNumber,
                deletedAt: null,
              }
            });
          }
        }

        const locName = locationName.trim();
        let location = await tx.location.findFirst({ where: { name: locName } });
        if (!location) {
          location = await tx.location.create({
            data: {
              name: locName,
              type: 'other',
            }
          });
        }

        const quantity = parseInt(quantityStr, 10);
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
          if (delta !== 0 || inventoryItem.deletedAt !== null) {
            inventoryItem = await tx.inventoryItem.update({
              where: { id: inventoryItem.id },
              data: { quantityOnHand: quantity, unit, deletedAt: null }
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

    if (processedCount === 0) {
      throw new BadRequestException('No valid inventory items found in the CSV. Ensure SKU, Name, Location, and Quantity are provided for each row.');
    }

    return { message: `Successfully processed ${processedCount} inventory items.` };
  }
}
