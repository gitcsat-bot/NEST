import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

export interface AuditRecordInput {
  actorUserId: string | null;
  action: string;
  targetType: string;
  targetId: string | null;
  beforeState?: unknown;
  afterState?: unknown;
  sessionId?: string;
  ipAddress?: string;
  userAgent?: string;
}

// TDS §11.1 — Write Path: "every domain-operation service method that
// changes state calls AuditService.record(...) inside the same DB
// transaction as the state change." This service exposes both a
// standalone `record` (for calls not already inside a transaction, e.g.
// auth events that aren't wrapped in a broader multi-step transaction)
// and `recordWithinTransaction` (for calls that must commit atomically
// with a state change — e.g. password reset's session invalidation).
//
// Database Design §7: the `nest_app` role has UPDATE/DELETE revoked on
// audit_log at the grant level — this service's inability to update or
// delete a row is a property of the database connection it runs on, not
// just something this class chooses not to do.
@Injectable()
export class AuditService {
  constructor(private readonly prisma: PrismaService) {}

  async record(input: AuditRecordInput): Promise<void> {
    await this.prisma.auditLog.create({
      data: {
        actorUserId: input.actorUserId,
        action: input.action,
        targetType: input.targetType,
        targetId: input.targetId,
        beforeState: input.beforeState as never,
        afterState: input.afterState as never,
        sessionId: input.sessionId,
        ipAddress: input.ipAddress,
        userAgent: input.userAgent,
      },
    });
  }
}
