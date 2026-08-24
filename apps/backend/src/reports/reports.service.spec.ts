import { Test, TestingModule } from '@nestjs/testing';
import { ReportsService } from './reports.service';
import { PrismaService } from '../prisma/prisma.service';

describe('ReportsService', () => {
  let service: ReportsService;
  let prismaMock: any;

  beforeEach(async () => {
    prismaMock = {
      auditLog: {
        count: jest.fn().mockResolvedValue(0),
        findMany: jest.fn().mockResolvedValue([]),
      },
      $queryRaw: jest.fn().mockResolvedValue([]),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [ReportsService, { provide: PrismaService, useValue: prismaMock }],
    }).compile();

    service = module.get<ReportsService>(ReportsService);
  });

  describe('securityReport', () => {
    it('counts account_locked_count using the login_failed + reason=account_locked filter', async () => {
      prismaMock.auditLog.count.mockResolvedValueOnce(4); // failed_login_count
      prismaMock.auditLog.count.mockResolvedValueOnce(2); // account_locked_count
      prismaMock.auditLog.count.mockResolvedValueOnce(1); // two_factor_failure_count
      prismaMock.auditLog.count.mockResolvedValueOnce(0); // role_change_count
      prismaMock.auditLog.count.mockResolvedValueOnce(0); // deactivation_count

      const report = await service.securityReport(30);

      expect(report.failed_login_count).toEqual(4);
      expect(report.account_locked_count).toEqual(2);
      expect(report.two_factor_failure_count).toEqual(1);
      expect(report.window_days).toEqual(30);

      // Second count() call is the account-locked one — verify it filters
      // on the JSON afterState.reason, not just the action name (a plain
      // action-name count would double-count every locked login as a
      // regular failed login, which is correct, but wouldn't let an
      // admin see how many of those failures were lockouts specifically).
      const secondCallArgs = prismaMock.auditLog.count.mock.calls[1][0];
      expect(secondCallArgs.where.afterState).toEqual({ path: ['reason'], equals: 'account_locked' });
    });
  });

  describe('loginReport', () => {
    it('derives unique_users_logged_in from distinct actorUserId rows', async () => {
      prismaMock.auditLog.count.mockResolvedValueOnce(10); // successful
      prismaMock.auditLog.count.mockResolvedValueOnce(3); // failed
      prismaMock.auditLog.findMany.mockResolvedValueOnce([
        { actorUserId: 'u1' },
        { actorUserId: 'u2' },
      ]);

      const report = await service.loginReport(7);

      expect(report.successful_login_count).toEqual(10);
      expect(report.failed_login_count).toEqual(3);
      expect(report.unique_users_logged_in).toEqual(2);
    });
  });

  describe('inventoryReport', () => {
    it('shapes materials_by_status from grouped rows and surfaces low-stock materials', async () => {
      prismaMock.$queryRaw
        .mockResolvedValueOnce([{ count: 12n }]) // total
        .mockResolvedValueOnce([
          { status: 'available', count: 8n },
          { status: 'issued', count: 4n },
        ]) // grouped by status
        .mockResolvedValueOnce([
          { id: 'mat-1', asset_definition_name: 'Demo Widget', quantity_on_hand: 3, reorder_threshold: 5 },
        ]) // low stock
        .mockResolvedValueOnce([{ count: 2n }]); // pending inventory requests

      const report = await service.inventoryReport();

      expect(report.total_materials).toEqual(12);
      expect(report.materials_by_status).toEqual({ available: 8, issued: 4 });
      expect(report.low_stock_materials).toHaveLength(1);
      expect(report.low_stock_materials[0].asset_definition_name).toEqual('Demo Widget');
      expect(report.pending_inventory_requests).toEqual(2);
    });
  });
});
