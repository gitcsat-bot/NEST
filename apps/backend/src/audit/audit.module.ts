import { Global, Module } from '@nestjs/common';
import { AuditService } from './audit.service';

// Global for the same reason PrismaModule is global — every domain
// module needs to write audit events, and re-importing per-module would
// be pure boilerplate (TDS §11.2: the audit module owns the closed
// action vocabulary; other modules only call this service, they don't
// reimplement logging).
@Global()
@Module({
  providers: [AuditService],
  exports: [AuditService],
})
export class AuditModule {}
