import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class SearchService {
  constructor(private readonly prisma: PrismaService) {}

  async searchAssets(query: string) {
    if (!query) return [];

    // Assuming we use tsvector search on search_vector column or just simple ILIKE for MVP
    // Prisma full-text search is experimental, so we can use a raw query or simple contains for MVP
    
    return this.prisma.assetInstance.findMany({
      where: {
        OR: [
          { displayCode: { contains: query, mode: 'insensitive' } },
          { serialNumber: { contains: query, mode: 'insensitive' } },
          { assetDefinition: { name: { contains: query, mode: 'insensitive' } } },
        ],
        deletedAt: null,
      },
      include: { assetDefinition: true, currentLocation: true },
      take: 20,
    });
  }

  async searchInventory(query: string) {
    if (!query) return [];

    return this.prisma.inventoryItem.findMany({
      where: {
        assetDefinition: {
          name: { contains: query, mode: 'insensitive' },
        },
        deletedAt: null,
      },
      include: { assetDefinition: true, location: true },
      take: 20,
    });
  }
}
