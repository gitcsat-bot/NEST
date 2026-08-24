import { Test, TestingModule } from '@nestjs/testing';
import { AssetStatus, InventoryRequestStatus } from '@nest/shared-types';
import { MaterialsService } from './materials.service';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { ApiException } from '../common/dto/api-exception';

// These tests mock $queryRaw/$executeRaw directly rather than a
// `.material`/`.inventoryRequest` delegate — see the note at the top of
// materials.service.ts for why the service is written that way for now.
// Mocking at the $queryRaw/$executeRaw boundary means these tests don't
// depend on which style the service uses internally; they'd need no
// changes if the service is later refactored to delegate calls once
// `prisma generate` has run in a networked environment.
describe('MaterialsService', () => {
  let service: MaterialsService;
  let prismaMock: any;
  let auditMock: any;

  const mockCtx = { ipAddress: '127.0.0.1', userAgent: 'test-agent' };

  const materialRow = (overrides: Partial<Record<string, unknown>> = {}) => ({
    id: 'mat-1',
    asset_definition_id: 'ad-1',
    asset_definition_name: 'Demo Widget',
    asset_definition_sku: 'DEMO-0001',
    location_id: 'loc-1',
    location_name: 'Demo Warehouse',
    status: AssetStatus.AVAILABLE,
    quantity_on_hand: 3,
    reorder_threshold: 5,
    notes: null,
    created_at: new Date(),
    updated_at: new Date(),
    ...overrides,
  });

  const inventoryRequestRow = (overrides: Partial<Record<string, unknown>> = {}) => ({
    id: 'req-1',
    material_id: 'mat-1',
    material_name: 'Demo Widget',
    requested_by_user_id: 'user-2',
    requested_by_display_name: 'Pending Student',
    requested_quantity: 10,
    reason: 'Running low',
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
      $transaction: jest.fn(async (cb: any) => cb({ $executeRaw: jest.fn() })),
      assetDefinition: { findUnique: jest.fn() },
      location: { findUnique: jest.fn() },
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

  // Powers the Catalog page's "which locations is this item stocked at"
  // panel — GET /materials?asset_definition_id=... filters down to just
  // that catalog item's Material rows.
  describe('findAll — asset_definition_id filter', () => {
    it('includes an asset_definition_id condition in the WHERE clause when passed', async () => {
      prismaMock.$queryRaw
        .mockResolvedValueOnce([materialRow()]) // items query
        .mockResolvedValueOnce([{ count: 1n }]); // count query

      await service.findAll({ assetDefinitionId: 'ad-1', page: 1, pageSize: 25 });

      expect(prismaMock.$queryRaw).toHaveBeenCalledTimes(2);
      const itemsQuery = prismaMock.$queryRaw.mock.calls[0][0];
      const countQuery = prismaMock.$queryRaw.mock.calls[1][0];
      // Prisma.sql produces a tagged-template Sql object — check its
      // rendered `.sql` text and bound `.values` rather than string-
      // concatenating, since that's what actually gets sent to Postgres.
      expect(itemsQuery.sql).toContain('m.asset_definition_id = ');
      expect(itemsQuery.values).toContain('ad-1');
      expect(countQuery.sql).toContain('m.asset_definition_id = ');
      expect(countQuery.values).toContain('ad-1');
    });

    it('omits the condition entirely when no filters are passed', async () => {
      prismaMock.$queryRaw.mockResolvedValueOnce([]).mockResolvedValueOnce([{ count: 0n }]);

      await service.findAll({ page: 1, pageSize: 25 });

      const itemsQuery = prismaMock.$queryRaw.mock.calls[0][0];
      expect(itemsQuery.sql).not.toContain('WHERE');
    });
  });

  describe('create', () => {
    it('rejects an asset_definition_id that does not exist', async () => {
      prismaMock.assetDefinition.findUnique.mockResolvedValue(null);

      await expect(
        service.create({ asset_definition_id: 'missing' }, 'user-1', mockCtx),
      ).rejects.toThrow(ApiException);

      expect(prismaMock.$queryRaw).not.toHaveBeenCalled();
    });

    it('creates a material and records an audit entry', async () => {
      prismaMock.assetDefinition.findUnique.mockResolvedValue({ id: 'ad-1' });
      prismaMock.$queryRaw
        .mockResolvedValueOnce([{ id: 'mat-1' }]) // INSERT ... RETURNING id
        .mockResolvedValueOnce([materialRow()]); // findById() re-select

      const result = await service.create({ asset_definition_id: 'ad-1', quantity_on_hand: 3 }, 'user-1', mockCtx);

      expect(result.id).toEqual('mat-1');
      expect(auditMock.record).toHaveBeenCalledWith(
        expect.objectContaining({ action: 'material.created', targetId: 'mat-1' }),
      );
    });
  });

  describe('updateStatus', () => {
    it('rejects a transition not in MATERIAL_STATUS_TRANSITIONS', async () => {
      prismaMock.$queryRaw.mockResolvedValueOnce([materialRow({ status: AssetStatus.RETIRED })]);

      await expect(
        service.updateStatus('mat-1', AssetStatus.AVAILABLE, 'user-1', mockCtx),
      ).rejects.toThrow(ApiException);

      expect(prismaMock.$executeRaw).not.toHaveBeenCalled();
    });

    it('allows a valid transition and records an audit entry', async () => {
      prismaMock.$queryRaw
        .mockResolvedValueOnce([materialRow({ status: AssetStatus.AVAILABLE })]) // current state lookup
        .mockResolvedValueOnce([materialRow({ status: AssetStatus.ISSUED })]); // findById() re-select

      const result = await service.updateStatus('mat-1', AssetStatus.ISSUED, 'user-1', mockCtx);

      expect(result.status).toEqual(AssetStatus.ISSUED);
      expect(prismaMock.$executeRaw).toHaveBeenCalledTimes(1);
      expect(auditMock.record).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'material.status_changed',
          beforeState: { status: AssetStatus.AVAILABLE },
          afterState: { status: AssetStatus.ISSUED },
        }),
      );
    });

    it('404s when the material does not exist', async () => {
      prismaMock.$queryRaw.mockResolvedValueOnce([]);

      await expect(
        service.updateStatus('missing', AssetStatus.AVAILABLE, 'user-1', mockCtx),
      ).rejects.toThrow(ApiException);
    });
  });

  describe('createInventoryRequest', () => {
    it('404s if the material does not exist', async () => {
      prismaMock.$queryRaw.mockResolvedValueOnce([]); // findRowById

      await expect(
        service.createInventoryRequest('missing', { requested_quantity: 5 }, 'user-2', mockCtx),
      ).rejects.toThrow(ApiException);
    });

    it('creates a pending request and records an audit entry', async () => {
      prismaMock.$queryRaw
        .mockResolvedValueOnce([materialRow()]) // findRowById existence check
        .mockResolvedValueOnce([{ id: 'req-1' }]) // INSERT ... RETURNING id
        .mockResolvedValueOnce([inventoryRequestRow()]); // findInventoryRequestById() re-select

      const result = await service.createInventoryRequest(
        'mat-1',
        { requested_quantity: 10, reason: 'Running low' },
        'user-2',
        mockCtx,
      );

      expect(result.id).toEqual('req-1');
      expect(result.status).toEqual(InventoryRequestStatus.PENDING);
      expect(auditMock.record).toHaveBeenCalledWith(
        expect.objectContaining({ action: 'inventory_request.created', targetId: 'req-1' }),
      );
    });
  });

  describe('reviewInventoryRequest', () => {
    it('rejects reviewing a request that is already resolved', async () => {
      prismaMock.$queryRaw.mockResolvedValueOnce([inventoryRequestRow({ status: InventoryRequestStatus.APPROVED })]);

      await expect(
        service.reviewInventoryRequest('req-1', 'approved', 'admin-1', mockCtx),
      ).rejects.toThrow(ApiException);

      expect(prismaMock.$transaction).not.toHaveBeenCalled();
    });

    it('approving increments quantity_on_hand inside a transaction and records an audit entry', async () => {
      const txExecuteRaw = jest.fn();
      prismaMock.$transaction.mockImplementationOnce(async (cb: any) => cb({ $executeRaw: txExecuteRaw }));
      prismaMock.$queryRaw
        .mockResolvedValueOnce([inventoryRequestRow({ status: InventoryRequestStatus.PENDING })]) // pre-check
        .mockResolvedValueOnce([
          inventoryRequestRow({ status: InventoryRequestStatus.APPROVED, reviewed_by_user_id: 'admin-1' }),
        ]); // post-review re-select

      const result = await service.reviewInventoryRequest('req-1', 'approved', 'admin-1', mockCtx);

      expect(result.status).toEqual(InventoryRequestStatus.APPROVED);
      // One UPDATE materials (quantity bump) + one UPDATE inventory_requests (status).
      expect(txExecuteRaw).toHaveBeenCalledTimes(2);
      expect(auditMock.record).toHaveBeenCalledWith(
        expect.objectContaining({ action: 'inventory_request.approved', targetId: 'req-1' }),
      );
    });

    it('rejecting does not touch materials, only marks the request rejected', async () => {
      const txExecuteRaw = jest.fn();
      prismaMock.$transaction.mockImplementationOnce(async (cb: any) => cb({ $executeRaw: txExecuteRaw }));
      prismaMock.$queryRaw
        .mockResolvedValueOnce([inventoryRequestRow({ status: InventoryRequestStatus.PENDING })])
        .mockResolvedValueOnce([inventoryRequestRow({ status: InventoryRequestStatus.REJECTED })]);

      const result = await service.reviewInventoryRequest('req-1', 'rejected', 'admin-1', mockCtx);

      expect(result.status).toEqual(InventoryRequestStatus.REJECTED);
      // Only the inventory_requests status UPDATE — no materials UPDATE.
      expect(txExecuteRaw).toHaveBeenCalledTimes(1);
    });
  });
});
