import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import * as nodemailer from 'nodemailer';
import { Prisma } from '../../generated/prisma';
import { PrismaService } from '../prisma/prisma.service';

// See mail.service.ts's doc comment for the overall design (Postgres
// outbox standing in for BullMQ+Redis). This is the "worker process"
// half — a polling loop that claims pending rows and attempts delivery.
//
// IMPORTANT: claiming a row and delivering it are deliberately NOT
// wrapped in one Prisma transaction. An earlier version did that (SELECT
// ... FOR UPDATE, send, UPDATE, all inside `$transaction`), and it broke
// in practice: Prisma's interactive transactions have a 5-second default
// timeout, and a real SMTP round-trip (Gmail, in particular) can take
// longer than that under normal network variance. When the transaction
// expired mid-send, the email had *already gone out* — nodemailer isn't
// transactional, sending can't be rolled back — but the final status
// update failed, so the row stayed `pending` and got resent on the next
// poll. Raising the timeout would only have delayed the same failure on
// a slower day; the actual fix is to never hold a DB transaction open
// across an external network call. Claiming (a plain UPDATE ... WHERE
// status = 'pending') and delivering now happen as separate,
// non-transactional steps.
//
// This is safe as a single Node process (the `polling` flag below
// already prevents this instance's own poll cycles from overlapping).
// If this ever runs as more than one instance, the plain claim step
// below has a real TOCTOU race — the fix at that point is an atomic
// `UPDATE ... SET status = 'sending' WHERE status = 'pending' RETURNING
// *` claim (a new `sending` EmailStatus value), not reintroducing a
// transaction around the send.
//
// Delivery has three paths, checked in order:
//   1. Recipient is a designated dev/test account (MAIL_CONSOLE_TEST_ACCOUNTS,
//      defaults to admin@nest.local, test@nest.local, student@nest.local —
//      the three accounts seed.ts creates specifically so 2FA OTPs and
//      password-reset links can be read straight off this console
//      without needing a real mailbox) → always logs to console,
//      regardless of whether SMTP is configured. This is what "do their
//      2FA in terminals" from the original ask depends on.
//   2. SMTP_HOST is configured → real delivery via nodemailer.
//   3. Neither of the above → dev fallback: log to console with a loud
//      "NO SMTP CONFIGURED" marker so a misconfigured environment is
//      obvious, and still mark the message sent (otherwise every
//      non-test email would retry forever in a dev environment that was
//      never going to have SMTP creds).
const DEFAULT_CONSOLE_TEST_ACCOUNTS = ['admin@nest.local', 'test@nest.local', 'student@nest.local'];
const POLL_MS = Number(process.env.MAIL_WORKER_POLL_MS ?? 2000);
const BATCH_SIZE = 10;
const MAX_ATTEMPTS = 3;

interface OutboxRow {
  id: string;
  to_email: string;
  subject: string;
  body_text: string;
  attempts: number;
}

@Injectable()
export class MailWorkerService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(MailWorkerService.name);
  private timer: NodeJS.Timeout | null = null;
  private polling = false;
  private transporter: nodemailer.Transporter | null = null;
  private consoleTestAccounts: Set<string>;

  constructor(private readonly prisma: PrismaService) {
    this.consoleTestAccounts = new Set(
      (process.env.MAIL_CONSOLE_TEST_ACCOUNTS?.split(',').map((s) => s.trim().toLowerCase()) ??
        DEFAULT_CONSOLE_TEST_ACCOUNTS),
    );
    this.transporter = this.buildTransport();
  }

  onModuleInit() {
    this.timer = setInterval(() => {
      void this.pollOnce();
    }, POLL_MS);
    this.logger.log(`Mail worker polling every ${POLL_MS}ms (Phase-1-lite MVP — see mail.service.ts doc comment)`);
  }

  onModuleDestroy() {
    if (this.timer) clearInterval(this.timer);
  }

  private buildTransport(): nodemailer.Transporter | null {
    if (!process.env.SMTP_HOST) return null;
    return nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: Number(process.env.SMTP_PORT ?? 587),
      secure: process.env.SMTP_SECURE === 'true',
      auth: process.env.SMTP_USER
        ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASSWORD }
        : undefined,
    });
  }

  private async pollOnce() {
    if (this.polling) return; // A previous poll is still running — don't overlap.
    this.polling = true;
    try {
      const pending = await this.prisma.$queryRaw<{ id: string }[]>(
        Prisma.sql`
          SELECT id FROM email_outbox
          WHERE status = 'pending'::"EmailStatus"
          ORDER BY created_at ASC
          LIMIT ${BATCH_SIZE}
        `,
      );
      for (const { id } of pending) {
        await this.processOne(id);
      }
    } catch (err) {
      this.logger.error(`Mail worker poll failed: ${String(err)}`);
    } finally {
      this.polling = false;
    }
  }

  private async processOne(id: string) {
    const rows = await this.prisma.$queryRaw<OutboxRow[]>(
      Prisma.sql`
        SELECT id, to_email, subject, body_text, attempts
        FROM email_outbox
        WHERE id = ${id}::uuid AND status = 'pending'::"EmailStatus"
      `,
    );
    const row = rows[0];
    if (!row) return; // No longer pending — already handled (see the concurrency note above).

    try {
      await this.deliver(row.to_email, row.subject, row.body_text);
      await this.prisma.$executeRaw(
        Prisma.sql`UPDATE email_outbox SET status = 'sent'::"EmailStatus", sent_at = CURRENT_TIMESTAMP WHERE id = ${id}::uuid`,
      );
    } catch (err) {
      const attempts = row.attempts + 1;
      const nextStatus = attempts >= MAX_ATTEMPTS ? 'failed' : 'pending';
      this.logger.warn(`Delivery attempt ${attempts} failed for ${row.to_email}: ${String(err)}`);
      await this.prisma.$executeRaw(
        Prisma.sql`
          UPDATE email_outbox
          SET attempts = ${attempts}, last_error = ${String(err)}, status = ${nextStatus}::"EmailStatus"
          WHERE id = ${id}::uuid
        `,
      );
    }
  }

  private async deliver(toEmail: string, subject: string, bodyText: string): Promise<void> {
    if (this.consoleTestAccounts.has(toEmail.toLowerCase())) {
      console.log(`[MAIL WORKER — TEST ACCOUNT] To: ${toEmail} | Subject: ${subject}\n${bodyText}`);
      return;
    }

    if (this.transporter) {
      await this.transporter.sendMail({
        from: process.env.SMTP_FROM ?? 'no-reply@nest.local',
        to: toEmail,
        subject,
        text: bodyText,
      });
      return;
    }

    console.log(
      `[MAIL WORKER — NO SMTP CONFIGURED, DEV FALLBACK] To: ${toEmail} | Subject: ${subject}\n${bodyText}`,
    );
  }
}
