import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { SessionAuthGuard } from './guards/session-auth.guard';
import { RolesGuard } from './guards/roles.guard';
import { StepUpGuard } from './guards/step-up.guard';
import { MailModule } from '../mail/mail.module';

// Registers the three guards globally, in order: SessionAuthGuard first
// (populates request.user; short-circuits @Public() routes), then
// RolesGuard (role-level check), then StepUpGuard (freshness check for
// the specific marked routes). TDS §5.2's "both guards run server-side,
// before the handler, on every non-public route" is what this ordering
// guarantees — Nest runs APP_GUARD providers in registration order.
@Module({
  imports: [MailModule],
  controllers: [AuthController],
  providers: [
    AuthService,
    { provide: APP_GUARD, useClass: SessionAuthGuard },
    { provide: APP_GUARD, useClass: RolesGuard },
    { provide: APP_GUARD, useClass: StepUpGuard },
  ],
  exports: [AuthService],
})
export class AuthModule {}
