import { Test, TestingModule } from '@nestjs/testing';
import { MaterialsService } from './materials.service';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { ReservationStatus } from '../../generated/prisma';

describe('MaterialsService', () => {
  let service: MaterialsService;
  let prismaMock: any;
  let auditMock: any;

  const mockCtx = { ipAddress: '127.0.0.1', userAgent: 'test-agent' };

  beforeEach(async () => {
    prismaMock = {
      $transaction: jest.fn(async (cb: any) => cb(prismaMock)),
      assetDefinition: { findUnique: jest.fn() },
      location: { findUnique: jest.fn() },
      inventoryItem: {
        findMany: jest.fn(),
        count: jest.fn(),
        findUnique: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
      },
      reservation: {
        findMany: jest.fn(),
        count: jest.fn(),
        findUnique: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
      },
    };
    auditMock = { record: jest.fn().mockResolvedValue(undefined) };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        MaterialsService,
        { provide: PrismaService, useValue: prismaMock },
        { provide: AuditService, useValue: auditMock },
      ],
    }).compile();

    service = module.get<MaterialsService>(MaterialsService);
  });

  describe('findAll', () => {
    it('returns items correctly', async () => {
      prismaMock.inventoryItem.findMany.mockResolvedValueOnce([]);
      prismaMock.inventoryItem.count.mockResolvedValueOnce(0);
      const res = await service.findAll({ page: 1, pageSize: 25 });
      expect(res.total).toBe(0);
    });
  });

  describe('create', () => {
    it('rejects an asset_definition_id that does not exist', async () => {
      prismaMock.assetDefinition.findUnique.mockResolvedValue(null);
      await expect(service.create({ asset_definition_id: 'missing' }, 'u1', mockCtx)).rejects.toThrow();
    });

    it('creates a material and records an audit entry', async () => {
      prismaMock.assetDefinition.findUnique.mockResolvedValue({ id: 'ad-1' });
      prismaMock.inventoryItem.create.mockResolvedValueOnce({ id: 'mat-1', quantityOnHand: 3, assetDefinition: {}, location: {} });
      const result = await service.create({ asset_definition_id: 'ad-1', quantity_on_hand: 3 }, 'user-1', mockCtx);
      expect(result.id).toEqual('mat-1');
      expect(auditMock.record).toHaveBeenCalled();
    });
  });

  describe('createInventoryRequest', () => {
    it('404s if material does not exist', async () => {
      prismaMock.inventoryItem.findUnique.mockResolvedValueOnce(null);
      await expect(service.createInventoryRequest('missing', { requested_quantity: 5 }, 'u', mockCtx)).rejects.toThrow();
    });

    it('creates a request and records audit', async () => {
      prismaMock.inventoryItem.findUnique.mockResolvedValueOnce({ id: 'mat-1', assetDefinition: {} });
      prismaMock.reservation.create.mockResolvedValueOnce({ id: 'req-1', status: ReservationStatus.active });
      const res = await service.createInventoryRequest('mat-1', { requested_quantity: 10 }, 'u', mockCtx);
      expect(res.id).toEqual('req-1');
      expect(auditMock.record).toHaveBeenCalled();
    });
  });

  describe('reviewInventoryRequest', () => {
    it('rejects if already resolved', async () => {
      prismaMock.reservation.findUnique.mockResolvedValueOnce({ status: ReservationStatus.fulfilled });
      await expect(service.reviewInventoryRequest('req-1', 'approved', 'a1', mockCtx)).rejects.toThrow();
    });

    it('approves and updates inventory', async () => {
      prismaMock.reservation.findUnique.mockResolvedValueOnce({ status: ReservationStatus.active, quantity: 5, targetId: 'mat-1' }) // first call
        .mockResolvedValueOnce({ id: 'req-1', status: ReservationStatus.fulfilled }); // second call at end
      prismaMock.inventoryItem.findUnique.mockResolvedValueOnce({});
      
      const res = await service.reviewInventoryRequest('req-1', 'approved', 'a1', mockCtx);
      expect(res.id).toEqual('req-1');
      expect(prismaMock.inventoryItem.update).toHaveBeenCalled();
      expect(auditMock.record).toHaveBeenCalled();
    });

    it('rejects without updating inventory', async () => {
      prismaMock.reservation.findUnique.mockResolvedValueOnce({ status: ReservationStatus.active, quantity: 5, targetId: 'mat-1' }) // first call
        .mockResolvedValueOnce({ id: 'req-1', status: ReservationStatus.cancelled }); // second call at end
      prismaMock.inventoryItem.findUnique.mockResolvedValueOnce({});
      
      const res = await service.reviewInventoryRequest('req-1', 'rejected', 'a1', mockCtx);
      expect(res.id).toEqual('req-1');
      expect(prismaMock.inventoryItem.update).not.toHaveBeenCalled();
      expect(auditMock.record).toHaveBeenCalled();
    });
  });
});
