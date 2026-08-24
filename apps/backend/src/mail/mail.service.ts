import { Injectable } from '@nestjs/common';
import { Prisma } from '../../generated/prisma';
import { PrismaService } from '../prisma/prisma.service';

// Email worker — Phase-1-lite MVP. Security Design §2's target
// architecture is a BullMQ+Redis worker process reading jobs off Redis;
// this is a smaller stand-in that gets the same *behavior* (email
// sending is decoupled from the request that triggers it, survives a
// backend restart, and retries on failure) without provisioning Redis.
//
// The outbox table (`email_outbox`) is the durable job queue; MailWorkerService
// is the "worker process" that polls it. AuthService and anything else
// that needs to send mail only ever calls `MailService.enqueue()` — it
// never sends synchronously, so a slow/unreachable SMTP server never
// blocks a login or password-reset request.
//
// Migration path to the target architecture: swap MailWorkerService's
// polling loop for a BullMQ processor; `email_outbox` can stay as-is as a
// delivery audit trail, or be dropped once BullMQ's own job store is
// trusted for that.
//
// Uses $queryRaw/$executeRaw rather than a `.emailOutboxMessage` Prisma
// delegate for the same reason materials.service.ts does — see the note
// at the top of that file.
@Injectable()
export class MailService {
  constructor(private readonly prisma: PrismaService) {}

  async enqueue(toEmail: string, subject: string, bodyText: string): Promise<void> {
    await this.prisma.$executeRaw(
      Prisma.sql`
        INSERT INTO email_outbox (to_email, subject, body_text)
        VALUES (${toEmail}, ${subject}, ${bodyText})
      `,
    );
  }

  async sendEmailVerification(toEmail: string, token: string): Promise<void> {
    const frontendUrl = process.env.FRONTEND_URL ?? 'http://localhost:5173';
    const link = `${frontendUrl}/verify-email?token=${token}`;
    
    await this.enqueue(
      toEmail,
      'NEST: Verify your email address',
      `Welcome to NEST! Please verify your email address to activate your account.\n\nClick the link below:\n${link}\n\nIf you did not request this, please ignore this email.`,
    );
  }

  async sendPasswordReset(toEmail: string, token: string): Promise<void> {
    const frontendUrl = process.env.FRONTEND_URL ?? 'http://localhost:5173';
    const link = `${frontendUrl}/reset-password?token=${token}`;
    
    await this.enqueue(
      toEmail,
      'NEST: Password Reset Request',
      `We received a request to reset your NEST account password.\n\nClick the link below to set a new password:\n${link}\n\nThis link will expire in 15 minutes.\nIf you did not request this, please ignore this email and your password will remain unchanged.`,
    );
  }
}
