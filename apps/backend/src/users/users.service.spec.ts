import { Test, TestingModule } from '@nestjs/testing';
import { UserRole } from '@nest/shared-types';
import { UsersService } from './users.service';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { ApiException } from '../common/dto/api-exception';

// Focused on the two behaviors added for the Admin Approvals screen —
// rejectRole() and the has_pending_role list filter. Not a full
// UsersService suite (the pre-existing changeRole/approveRole/deactivate/
// reactivate methods were already shipped and unchanged by this work).
describe('UsersService — pending-role approval additions', () => {
  let service: UsersService;
  let prismaMock: any;
  let auditMock: any;

  const pendingUser = {
    id: 'user-2',
    email: 'pending-student@nest.local',
    displayName: 'Pending Student',
    role: 'viewer',
    pendingRole: 'student',
    isActive: true,
    totpEnabled: false,
    createdAt: new Date(),
    deactivatedAt: null,
  };

  beforeEach(async () => {
    prismaMock = {
      user: {
        findUnique: jest.fn(),
        findMany: jest.fn(),
        count: jest.fn(),
        update: jest.fn(),
      },
      $transaction: jest.fn(async (cb: any) => cb(prismaMock)),
    };
    auditMock = { record: jest.fn().mockResolvedValue(undefined) };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        UsersService,
        { provide: PrismaService, useValue: prismaMock },
        { provide: AuditService, useValue: auditMock },
      ],
    }).compile();

    service = module.get<UsersService>(UsersService);
  });

  describe('rejectRole', () => {
    it('rejects self-rejection, mirroring approveRole', async () => {
      await expect(service.rejectRole('admin-1', 'admin-1')).rejects.toThrow(ApiException);
      expect(prismaMock.user.findUnique).not.toHaveBeenCalled();
    });

    it('404s for a user that does not exist', async () => {
      prismaMock.user.findUnique.mockResolvedValue(null);
      await expect(service.rejectRole('missing', 'admin-1')).rejects.toThrow(ApiException);
    });

    it('rejects if the user has no pending role', async () => {
      prismaMock.user.findUnique.mockResolvedValue({ ...pendingUser, pendingRole: null });
      await expect(service.rejectRole('user-2', 'admin-1')).rejects.toThrow(ApiException);
    });

    it('clears pendingRole without touching role, and records an audit entry', async () => {
      prismaMock.user.findUnique.mockResolvedValue(pendingUser);
      prismaMock.user.update.mockResolvedValue({ ...pendingUser, pendingRole: null });

      const result = await service.rejectRole('user-2', 'admin-1');

      expect(result.role).toEqual(UserRole.VIEWER);
      expect(result.pending_role).toBeNull();
      expect(prismaMock.user.update).toHaveBeenCalledWith({
        where: { id: 'user-2' },
        data: { pendingRole: null },
      });
      expect(auditMock.record).toHaveBeenCalledWith(
        expect.objectContaining({ action: 'user.role_rejected', targetId: 'user-2' }),
      );
    });
  });

  describe('list with has_pending_role', () => {
    it('filters to pendingRole IS NOT NULL when has_pending_role=true', async () => {
      prismaMock.user.findMany.mockResolvedValue([pendingUser]);
      prismaMock.user.count.mockResolvedValue(1);

      await service.list({ hasPendingRole: true, page: 1, pageSize: 25 });

      expect(prismaMock.user.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: expect.objectContaining({ pendingRole: { not: null } }) }),
      );
    });

    it('filters to pendingRole IS NULL when has_pending_role=false', async () => {
      prismaMock.user.findMany.mockResolvedValue([]);
      prismaMock.user.count.mockResolvedValue(0);

      await service.list({ hasPendingRole: false, page: 1, pageSize: 25 });

      expect(prismaMock.user.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: expect.objectContaining({ pendingRole: null }) }),
      );
    });

    it('omits the pendingRole filter entirely when has_pending_role is not passed', async () => {
      prismaMock.user.findMany.mockResolvedValue([]);
      prismaMock.user.count.mockResolvedValue(0);

      await service.list({ page: 1, pageSize: 25 });

      const whereArg = prismaMock.user.findMany.mock.calls[0][0].where;
      expect(whereArg).not.toHaveProperty('pendingRole');
    });
  });
});
