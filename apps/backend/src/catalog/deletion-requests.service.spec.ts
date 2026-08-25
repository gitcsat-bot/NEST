import { Test, TestingModule } from '@nestjs/testing';
import { CatalogDeletionRequestsService } from './deletion-requests.service';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';

describe('CatalogDeletionRequestsService', () => {
  let service: CatalogDeletionRequestsService;
  let prismaMock: any;
  let auditMock: any;

  const mockCtx = { ipAddress: '127.0.0.1', userAgent: 'test-agent' };

  beforeEach(async () => {
    prismaMock = {
      $transaction: jest.fn(async (cb: any) => cb(prismaMock)),
      assetDefinition: { findUnique: jest.fn(), delete: jest.fn(), update: jest.fn() },
      inventoryItem: { updateMany: jest.fn() },
      assetInstance: { updateMany: jest.fn() },
      catalogDeletionRequest: {
        findFirst: jest.fn(),
        findUnique: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
      },
    };
    auditMock = { record: jest.fn().mockResolvedValue(undefined) };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CatalogDeletionRequestsService,
        { provide: PrismaService, useValue: prismaMock },
        { provide: AuditService, useValue: auditMock },
      ],
    }).compile();

    service = module.get<CatalogDeletionRequestsService>(CatalogDeletionRequestsService);
  });

  describe('create', () => {
    it('creates a request', async () => {
      prismaMock.assetDefinition.findUnique.mockResolvedValueOnce({ id: 'ad-1' });
      prismaMock.catalogDeletionRequest.findFirst.mockResolvedValueOnce(null);
      prismaMock.catalogDeletionRequest.create.mockResolvedValueOnce({ id: 'req-1', status: 'pending', createdAt: new Date() });
      
      const res = await service.create('ad-1', { reason: 'x' }, 'u', mockCtx);
      expect(res.id).toEqual('req-1');
    });
  });

  describe('review', () => {
    it('approves and deletes', async () => {
      prismaMock.catalogDeletionRequest.findUnique.mockResolvedValueOnce({ status: 'pending', assetDefinitionId: 'ad-1' });
      prismaMock.catalogDeletionRequest.update.mockResolvedValueOnce({ id: 'req-1', status: 'approved', createdAt: new Date() });
      await service.review('req-1', 'approved', 'u', mockCtx);
      expect(prismaMock.assetDefinition.update).toHaveBeenCalled();
    });

    it('rejects without deleting', async () => {
      prismaMock.catalogDeletionRequest.findUnique
        .mockResolvedValueOnce({ status: 'pending', assetDefinitionId: 'ad-1' })
        .mockResolvedValueOnce({ id: 'req-1', status: 'rejected', createdAt: new Date() });
      prismaMock.catalogDeletionRequest.update.mockResolvedValueOnce({ id: 'req-1', status: 'rejected', createdAt: new Date() });
      await service.review('req-1', 'rejected', 'u', mockCtx);
      expect(prismaMock.assetDefinition.delete).not.toHaveBeenCalled();
      expect(prismaMock.assetDefinition.update).not.toHaveBeenCalled();
    });
  });
});
