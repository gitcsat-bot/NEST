import { Test, TestingModule } from '@nestjs/testing';
import { LocationsService } from './locations.service';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { LocationType } from '@nest/shared-types';
import { ApiException } from '../common/dto/api-exception';

describe('LocationsService', () => {
  let service: LocationsService;
  let prismaMock: any;
  let auditMock: any;

  const mockCtx = {
    ipAddress: '127.0.0.1',
    userAgent: 'test-agent',
  };

  beforeEach(async () => {
    prismaMock = {
      location: {
        findMany: jest.fn(),
        findUnique: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
      },
    };

    auditMock = {
      record: jest.fn().mockResolvedValue(undefined),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        LocationsService,
        { provide: PrismaService, useValue: prismaMock },
        { provide: AuditService, useValue: auditMock },
      ],
    }).compile();

    service = module.get<LocationsService>(LocationsService);
  });

  describe('create', () => {
    it('should create a top-level location and record audit log', async () => {
      const createdLoc = {
        id: 'loc-1',
        name: 'Warehouse A',
        type: LocationType.WAREHOUSE,
        parentLocationId: null,
        description: 'Main warehouse',
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      prismaMock.location.create.mockResolvedValue(createdLoc);
      prismaMock.location.findUnique.mockResolvedValue(createdLoc);

      const result = await service.create(
        {
          name: 'Warehouse A',
          type: LocationType.WAREHOUSE,
          description: 'Main warehouse',
        },
        'user-1',
        mockCtx,
      );

      expect(result.id).toEqual('loc-1');
      expect(result.name).toEqual('Warehouse A');
      expect(auditMock.record).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'location.created',
          targetId: 'loc-1',
        }),
      );
    });

    it('should throw validation error if parent_location_id does not exist', async () => {
      prismaMock.location.findUnique.mockResolvedValue(null);

      await expect(
        service.create(
          {
            name: 'Shelf 1',
            type: LocationType.SHELF,
            parent_location_id: 'non-existent',
          },
          'user-1',
          mockCtx,
        ),
      ).rejects.toThrow(ApiException);
    });
  });

  describe('cycle prevention (DoD requirement)', () => {
    it('should reject setting parent to self', async () => {
      prismaMock.location.findUnique.mockResolvedValue({
        id: 'loc-1',
        name: 'Warehouse A',
        parentLocationId: null,
      });

      await expect(
        service.update(
          'loc-1',
          { parent_location_id: 'loc-1' },
          'user-1',
          mockCtx,
        ),
      ).rejects.toThrow(ApiException);
    });

    it('should reject reparenting into an own descendant (cycle prevention)', async () => {
      // Tree: loc-1 (Warehouse) -> loc-2 (Room) -> loc-3 (Shelf)
      // Attempt to set parent of loc-1 to loc-3
      prismaMock.location.findUnique.mockImplementation(({ where }: any) => {
        if (where.id === 'loc-1') {
          return Promise.resolve({
            id: 'loc-1',
            name: 'Warehouse A',
            parentLocationId: null,
          });
        }
        if (where.id === 'loc-3') {
          return Promise.resolve({
            id: 'loc-3',
            name: 'Shelf 1',
            parentLocationId: 'loc-2',
          });
        }
        if (where.id === 'loc-2') {
          return Promise.resolve({
            id: 'loc-2',
            name: 'Room 101',
            parentLocationId: 'loc-1',
          });
        }
        return Promise.resolve(null);
      });

      await expect(
        service.update(
          'loc-1',
          { parent_location_id: 'loc-3' },
          'user-1',
          mockCtx,
        ),
      ).rejects.toThrow(ApiException);
    });
  });

  describe('archive', () => {
    it('should throw conflict error if active child locations exist', async () => {
      prismaMock.location.findUnique.mockResolvedValue({
        id: 'loc-1',
        name: 'Warehouse A',
        isActive: true,
        childLocations: [{ id: 'loc-2', name: 'Room 101', isActive: true }],
      });

      await expect(service.archive('loc-1', 'user-1', mockCtx)).rejects.toThrow(
        ApiException,
      );
    });

    it('should archive location if no active child locations exist', async () => {
      prismaMock.location.findUnique.mockResolvedValue({
        id: 'loc-2',
        name: 'Room 101',
        isActive: true,
        childLocations: [],
      });
      prismaMock.location.update.mockResolvedValue({
        id: 'loc-2',
        name: 'Room 101',
        isActive: false,
        parentLocationId: 'loc-1',
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      const result = await service.archive('loc-2', 'user-1', mockCtx);
      expect(result.is_active).toBe(false);
      expect(auditMock.record).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'location.archived',
          targetId: 'loc-2',
        }),
      );
    });
  });
});
