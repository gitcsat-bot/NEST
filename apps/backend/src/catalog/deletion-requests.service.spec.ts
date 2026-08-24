import { Test, TestingModule } from '@nestjs/testing';
import { InventoryRequestStatus } from '@nest/shared-types';
import { CatalogDeletionRequestsService } from './deletion-requests.service';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { ApiException } from '../common/dto/api-exception';

describe('CatalogDeletionRequestsService', () => {
  let service: CatalogDeletionRequestsService;
  let prismaMock: any;
  let auditMock: any;

  const mockCtx = { ipAddress: '127.0.0.1', userAgent: 'test-agent' };

  const requestRow = (overrides: Partial<Record<string, unknown>> = {}) => ({
    id: 'req-1',
    asset_definition_id: 'ad-1',
    asset_definition_name: 'Demo Widget',
    asset_definition_sku: 'DEMO-0001',
    requested_by_user_id: 'user-2',
    requested_by_display_name: 'Pending Student',
    reason: 'No longer used',
    status: InventoryRequestStatus.PENDING,
    reviewed_by_user_id: null,
    reviewed_by_display_name: null,
    reviewed_at: null,
    created_at: new Date(),
    ...overrides,
  });

  beforeEach(async () => {
    prismaMock = {
      $queryRaw: jest.fn(),
      $executeRaw: jest.fn(),
      $transaction: jest.fn(async (cb: any) => cb({ assetDefinition: { delete: jest.fn() }, $executeRaw: jest.fn() })),
      assetDefinition: { findUnique: jest.fn() },
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
    it('404s when the asset definition does not exist', async () => {
      prismaMock.assetDefinition.findUnique.mockResolvedValue(null);

      await expect(service.create('missing', {}, 'user-2', mockCtx)).rejects.toThrow(ApiException);
      expect(prismaMock.$queryRaw).not.toHaveBeenCalled();
    });

    it('rejects a second request while one is already pending', async () => {
      prismaMock.assetDefinition.findUnique.mockResolvedValue({ id: 'ad-1' });
      prismaMock.$queryRaw.mockResolvedValueOnce([{ id: 'existing-pending' }]);

      await expect(service.create('ad-1', {}, 'user-2', mockCtx)).rejects.toThrow(ApiException);
    });

    it('creates a pending request and records an audit entry', async () => {
      prismaMock.assetDefinition.findUnique.mockResolvedValue({ id: 'ad-1' });
      prismaMock.$queryRaw
        .mockResolvedValueOnce([]) // no existing pending
        .mockResolvedValueOnce([{ id: 'req-1' }]) // INSERT ... RETURNING id
        .mockResolvedValueOnce([requestRow()]); // findById() re-select

      const result = await service.create('ad-1', { reason: 'No longer used' }, 'user-2', mockCtx);

      expect(result.id).toEqual('req-1');
      expect(result.status).toEqual(InventoryRequestStatus.PENDING);
      expect(auditMock.record).toHaveBeenCalledWith(
        expect.objectContaining({ action: 'catalog.deletion_requested', targetId: 'ad-1' }),
      );
    });
  });

  describe('review', () => {
    it('rejects reviewing a request that is already resolved', async () => {
      prismaMock.$queryRaw.mockResolvedValueOnce([requestRow({ status: InventoryRequestStatus.REJECTED })]);

      await expect(service.review('req-1', 'approved', 'admin-1', mockCtx)).rejects.toThrow(ApiException);
      expect(prismaMock.$transaction).not.toHaveBeenCalled();
    });

    it('approving deletes the asset definition inside the transaction', async () => {
      const deleteFn = jest.fn();
      const txExecuteRaw = jest.fn();
      prismaMock.$transaction.mockImplementationOnce(async (cb: any) =>
        cb({ assetDefinition: { delete: deleteFn }, $executeRaw: txExecuteRaw }),
      );
      prismaMock.$queryRaw.mockResolvedValueOnce([requestRow({ status: InventoryRequestStatus.PENDING })]);

      const result = await service.review('req-1', 'approved', 'admin-1', mockCtx);

      expect(deleteFn).toHaveBeenCalledWith({ where: { id: 'ad-1' } });
      expect(txExecuteRaw).toHaveBeenCalledTimes(1);
      expect(result).toEqual({ deleted: true, request_id: 'req-1' });
      expect(auditMock.record).toHaveBeenCalledWith(
        expect.objectContaining({ action: 'catalog.deletion_approved' }),
      );
    });

    it('rejecting does not touch the asset definition', async () => {
      const deleteFn = jest.fn();
      const txExecuteRaw = jest.fn();
      prismaMock.$transaction.mockImplementationOnce(async (cb: any) =>
        cb({ assetDefinition: { delete: deleteFn }, $executeRaw: txExecuteRaw }),
      );
      prismaMock.$queryRaw
        .mockResolvedValueOnce([requestRow({ status: InventoryRequestStatus.PENDING })]) // pre-check
        .mockResolvedValueOnce([requestRow({ status: InventoryRequestStatus.REJECTED })]); // findById() re-select

      const result = await service.review('req-1', 'rejected', 'admin-1', mockCtx);

      expect(deleteFn).not.toHaveBeenCalled();
      expect((result as any).status).toEqual(InventoryRequestStatus.REJECTED);
    });

    it('surfaces a clear conflict when the item still has materials assigned (FK RESTRICT)', async () => {
      const fkError: any = new Error('Foreign key constraint failed');
      fkError.code = 'P2003';
      prismaMock.$transaction.mockImplementationOnce(async () => {
        throw fkError;
      });
      prismaMock.$queryRaw.mockResolvedValueOnce([requestRow({ status: InventoryRequestStatus.PENDING })]);

      await expect(service.review('req-1', 'approved', 'admin-1', mockCtx)).rejects.toMatchObject({
        response: { error: { message: expect.stringContaining('materials assigned to a location') } },
      });
    });
  });
});
