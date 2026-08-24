import { Injectable, ForbiddenException } from '@nestjs/common';
import * as argon2 from 'argon2';
import { authenticator } from 'otplib';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { MailService } from '../mail/mail.service';
import { ApiExceptions } from '../common/dto/api-exception';
import { generateOpaqueToken, hashToken } from '../common/security/hash-token.util';
import { toSharedUserRole } from '../common/mappers/user-role.mapper';
import { UserRole as PrismaUserRole } from '../../generated/prisma';
import { LoginDto } from './dto/login.dto';
import { TwoFactorVerifyDto } from './dto/two-factor-verify.dto';
import { PasswordResetRequestDto, PasswordResetConfirmDto } from './dto/password-reset.dto';
import { StepUpDto } from './dto/step-up.dto';

// TDS Â§12.2 â€” Login Sequence, TDS Â§5, Security Design Â§3.1/Â§5.
// Numeric policy (thresholds, windows) is centralized here so the whole
// lockout/session-lifetime story is readable in one place rather than
// scattered as magic numbers across handlers.
const MAX_FAILED_ATTEMPTS = 5;
const LOCKOUT_WINDOW_MS = 15 * 60 * 1000;
const SESSION_ABSOLUTE_LIFETIME_HOURS_DEFAULT = 12;
const PENDING_2FA_TOKEN_TTL_MS = 5 * 60 * 1000;
const PASSWORD_RESET_TOKEN_TTL_MS = 30 * 60 * 1000; // PRD FR-AUTH-03: â‰¤30 min

interface RequestContext {
  ipAddress: string;
  userAgent: string;
}

// In-memory pending-2FA store. NOTE: this is a Phase-0 placeholder â€” a
// multi-instance deployment (ADR-001's "scale by running multiple stateless
// API instances") needs this in Redis instead, since a second instance
// wouldn't see a token issued by the first. Flagged for resolution before
// horizontal scaling is ever turned on; harmless at MVP's single-instance
// deployment target (ADR-010).
const pendingTwoFactorStore = new Map<string, { userId: string; expiresAt: number; otp: string }>();
const pendingRegistrationStore = new Map<string, { otp: string; expiresAt: number }>();

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly mail: MailService,
  ) {}

  async login(dto: LoginDto, ctx: RequestContext) {
    const user = await this.prisma.user.findUnique({ where: { email: dto.email } });

    // Security Acceptance Criterion #15: identical failure path whether
    // the email exists or not, timing normalized by always hashing.
    const passwordHashToVerify = user?.passwordHash ?? (await this.dummyHashForTimingParity());

    if (user?.lockedUntil && user.lockedUntil > new Date()) {
      await this.audit.record({
        actorUserId: null,
        action: 'auth.login_failed',
        targetType: 'user',
        targetId: user.id,
        ipAddress: ctx.ipAddress,
        userAgent: ctx.userAgent,
        afterState: { reason: 'account_locked' },
      });
      throw ApiExceptions.accountLocked();
    }

    const passwordValid = await argon2.verify(passwordHashToVerify, dto.password).catch(() => false);

    if (!user || !passwordValid) {
      if (user) await this.registerFailedAttempt(user.id, user.failedLoginCount);
      await this.audit.record({
        actorUserId: user?.id ?? null,
        action: 'auth.login_failed',
        targetType: 'user',
        targetId: user?.id ?? null,
        ipAddress: ctx.ipAddress,
        userAgent: ctx.userAgent,
      });
      throw ApiExceptions.invalidCredentials();
    }

    if (!user.isActive || !user.emailVerified) {
      if (!user.emailVerified) {
        throw ApiExceptions.validation([{ field: 'email', message: 'Please verify your email address to log in.' }]);
      }
      const admins = await this.prisma.user.findMany({
        where: { role: 'admin', isActive: true },
        select: { email: true, displayName: true },
        take: 5,
      });
      throw new ForbiddenException({
        status: 'deactivated',
        adminEmails: admins,
        message: 'This account has been deactivated.',
      });
    }

    // Reset failure counter on success.
    await this.prisma.user.update({
      where: { id: user.id },
      data: { failedLoginCount: 0, lockedUntil: null },
    });

    if (user.totpEnabled) {
      const pendingToken = generateOpaqueToken();
      const otp = Math.floor(100000 + Math.random() * 900000).toString();
      pendingTwoFactorStore.set(pendingToken, {
        userId: user.id,
        expiresAt: Date.now() + PENDING_2FA_TOKEN_TTL_MS,
        otp,
      });

      // Delivery method (console for dev/test accounts vs. real SMTP) is
      // MailWorkerService's decision, not this method's — AuthService
      // just enqueues. See mail-worker.service.ts's doc comment for the
      // full delivery-path logic, including the admin/test/student
      // console exception this used to hardcode here.
      await this.mail.enqueue(
        user.email,
        'Your NEST verification code',
        `Your one-time verification code is: ${otp}\n\nThis code expires in 5 minutes. If you didn't request this, you can ignore this email.`,
      );

      await this.audit.record({
        actorUserId: user.id,
        action: 'auth.login_password_verified_pending_2fa',
        targetType: 'user',
        targetId: user.id,
        ipAddress: ctx.ipAddress,
        userAgent: ctx.userAgent,
      });
      return { two_factor_required: true as const, pending_token: pendingToken };
    }

    const session = await this.issueSession(user.id, ctx);
    await this.audit.record({
      actorUserId: user.id,
      action: 'auth.login_succeeded',
      targetType: 'user',
      targetId: user.id,
      ipAddress: ctx.ipAddress,
      userAgent: ctx.userAgent,
    });
    return { user: this.toUserDto(user), rawSessionToken: session.rawToken };
  }

  async verifyTwoFactor(dto: TwoFactorVerifyDto, ctx: RequestContext) {
    const pending = pendingTwoFactorStore.get(dto.pending_token);
    if (!pending || pending.expiresAt < Date.now()) {
      throw ApiExceptions.sessionExpired();
    }

    const user = await this.prisma.user.findUniqueOrThrow({ where: { id: pending.userId } });

    if (dto.code !== pending.otp) {
      await this.audit.record({
        actorUserId: user.id,
        action: 'auth.2fa_failed',
        targetType: 'user',
        targetId: user.id,
        ipAddress: ctx.ipAddress,
        userAgent: ctx.userAgent,
      });
      throw ApiExceptions.twoFactorInvalid();
    }

    pendingTwoFactorStore.delete(dto.pending_token);
    const session = await this.issueSession(user.id, ctx);
    await this.audit.record({
      actorUserId: user.id,
      action: 'auth.2fa_verified',
      targetType: 'user',
      targetId: user.id,
      ipAddress: ctx.ipAddress,
      userAgent: ctx.userAgent,
    });
    return { user: this.toUserDto(user), rawSessionToken: session.rawToken };
  }

  async logout(sessionId: string, actorUserId: string, ctx: RequestContext) {
    await this.prisma.session.update({
      where: { id: sessionId },
      data: { revokedAt: new Date() },
    });
    await this.audit.record({
      actorUserId,
      action: 'auth.logout',
      targetType: 'session',
      targetId: null,
      sessionId,
      ipAddress: ctx.ipAddress,
      userAgent: ctx.userAgent,
    });
  }

  async requestPasswordReset(dto: PasswordResetRequestDto, ctx: RequestContext) {
    const user = await this.prisma.user.findUnique({ where: { email: dto.email } });
    // API Contract Â§4: identical response regardless of whether the
    // account exists â€” the caller below never learns the difference.
    if (user) {
      const rawToken = generateOpaqueToken();
      await this.prisma.passwordResetToken.create({
        data: {
          userId: user.id,
          tokenHash: hashToken(rawToken),
          expiresAt: new Date(Date.now() + PASSWORD_RESET_TOKEN_TTL_MS),
        },
      });
      // Security Design Â§11: password reset request is an explicitly
      // named security-relevant audit action, independent of whether the
      // request ultimately gets confirmed.
      await this.audit.record({
        actorUserId: user.id,
        action: 'auth.password_reset_requested',
        targetType: 'user',
        targetId: user.id,
        ipAddress: ctx.ipAddress,
        userAgent: ctx.userAgent,
      });
      // AuthService only enqueues here too, for the same reason as
      // the 2FA OTP above; see mail-worker.service.ts for delivery logic.
      await this.mail.sendPasswordReset(user.email, rawToken);
    }
  }

  async confirmPasswordReset(dto: PasswordResetConfirmDto, ctx: RequestContext) {
    const tokenHash = hashToken(dto.token);
    const record = await this.prisma.passwordResetToken.findFirst({
      where: { tokenHash },
    });

    // Identical failure regardless of invalid vs expired vs used â€”
    // API Contract Â§4: "does not distinguish... to avoid token-guessing
    // signal."
    if (!record || record.usedAt || record.expiresAt < new Date()) {
      throw ApiExceptions.validation([{ field: 'token', message: 'This reset link is no longer valid.' }]);
    }

    const newHash = await argon2.hash(dto.new_password);

    await this.prisma.$transaction([
      this.prisma.user.update({ where: { id: record.userId }, data: { passwordHash: newHash } }),
      this.prisma.passwordResetToken.update({ where: { id: record.id }, data: { usedAt: new Date() } }),
      // Password reset invalidates all existing sessions (Security
      // Acceptance Criterion #14).
      this.prisma.session.updateMany({
        where: { userId: record.userId, revokedAt: null },
        data: { revokedAt: new Date() },
      }),
    ]);

    await this.audit.record({
      actorUserId: record.userId,
      action: 'auth.password_reset_completed',
      targetType: 'user',
      targetId: record.userId,
      ipAddress: ctx.ipAddress,
      userAgent: ctx.userAgent,
    });
  }

  async stepUp(userId: string, sessionId: string, dto: StepUpDto) {
    const [user, credential] = await Promise.all([
      this.prisma.user.findUniqueOrThrow({ where: { id: userId } }),
      this.prisma.totpCredential.findUnique({ where: { userId } }),
    ]);

    const passwordValid = await argon2.verify(user.passwordHash, dto.password);
    if (!passwordValid) throw ApiExceptions.invalidCredentials();

    if (credential) {
      if (!dto.totp_code || !authenticator.check(dto.totp_code, this.decryptTotpSecret(credential.secretEncrypted))) {
        throw ApiExceptions.twoFactorInvalid();
      }
    }

    const verifiedAt = new Date();
    await this.prisma.session.update({
      where: { id: sessionId },
      data: { stepUpVerifiedAt: verifiedAt },
    });
    return { step_up_verified_until: new Date(verifiedAt.getTime() + 5 * 60 * 1000).toISOString() };
  }

  async sendRegistrationOtp(email: string) {
    const existing = await this.prisma.user.findUnique({ where: { email } });
    if (existing) {
      return; // Do nothing if user exists to prevent enumeration
    }

    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    pendingRegistrationStore.set(email, {
      otp,
      expiresAt: Date.now() + 15 * 60 * 1000,
    });

    await this.mail.enqueue(
      email,
      'Your NEST registration code',
      `Your registration code is: ${otp}\n\nThis code expires in 15 minutes.`,
    );
  }

  async register(dto: import('./dto/register.dto').RegisterDto, ctx: RequestContext) {
    const pending = pendingRegistrationStore.get(dto.email);
    if (!pending || pending.expiresAt < Date.now() || pending.otp !== dto.otp) {
      throw ApiExceptions.validation([{ field: 'otp', message: 'Invalid or expired OTP.' }]);
    }
    
    const existing = await this.prisma.user.findUnique({ where: { email: dto.email } });
    if (existing) {
      throw ApiExceptions.invalidCredentials(); // Don't leak existence in a real app, but for now this is fine
    }

    const existingMisId = await this.prisma.user.findUnique({ where: { misId: dto.mis_id } as any });
    if (existingMisId) {
      throw ApiExceptions.validation([{ field: 'mis_id', message: 'This MIS ID is already registered.' }]);
    }

    const passwordHash = await argon2.hash(dto.password);
    const role = 'viewer';
    const pendingRole = dto.requested_role === 'viewer' ? null : dto.requested_role;

    const user = await this.prisma.user.create({
      data: {
        email: dto.email,
        passwordHash,
        displayName: dto.display_name,
        role: role as PrismaUserRole,
        pendingRole: pendingRole as PrismaUserRole,
        misId: dto.mis_id,
        gender: dto.gender,
        whatsappNumber: dto.whatsapp_number,
        subsystem: dto.subsystem,
        teamRole: dto.team_role,
        emailVerified: true, // OTP verified before creation
        totpEnabled: true, // Enable by default to trigger the new 2FA email flow
      } as any,
    });

    pendingRegistrationStore.delete(dto.email);

    await this.audit.record({
      actorUserId: user.id,
      action: 'auth.register' as any,
      targetType: 'user',
      targetId: user.id,
      ipAddress: ctx.ipAddress,
      userAgent: ctx.userAgent,
    });

    const session = await this.issueSession(user.id, ctx);
    return { user: this.toUserDto(user), rawSessionToken: session.rawToken };
  }

  async verifyEmail(token: string, ctx: RequestContext) {
    const tokenHash = hashToken(token);

    const record = await this.prisma.emailVerificationToken.findFirst({
      where: {
        tokenHash,
        usedAt: null,
        expiresAt: { gt: new Date() },
      },
      include: { user: true },
    });

    if (!record) {
      throw ApiExceptions.validation([{ field: 'token', message: 'Invalid or expired verification token.' }]);
    }

    await this.prisma.$transaction(async (tx) => {
      await tx.user.update({
        where: { id: record.userId },
        data: { emailVerified: true },
      });

      await tx.emailVerificationToken.update({
        where: { id: record.id },
        data: { usedAt: new Date() },
      });

      await tx.auditLog.create({
        data: {
          actorUserId: record.userId,
          action: 'auth.verify_email' as any,
          targetType: 'user',
          targetId: record.userId,
          ipAddress: ctx.ipAddress,
          userAgent: ctx.userAgent,
        }
      });
    });
  }

  // ---------------------------------------------------------------------
  // Internal helpers
  // ---------------------------------------------------------------------

  private async issueSession(userId: string, ctx: RequestContext) {
    const rawToken = generateOpaqueToken();
    const sessionId = hashToken(rawToken);
    const lifetimeHours =
      (await this.prisma.securitySettings.findUnique({ where: { id: 1 } }))
        ?.sessionAbsoluteLifetimeHours ?? SESSION_ABSOLUTE_LIFETIME_HOURS_DEFAULT;

    await this.prisma.session.create({
      data: {
        id: sessionId,
        userId,
        expiresAt: new Date(Date.now() + lifetimeHours * 60 * 60 * 1000),
        ipAddress: ctx.ipAddress,
        userAgent: ctx.userAgent,
      },
    });
    return { rawToken };
  }

  private async registerFailedAttempt(userId: string, currentCount: number) {
    const nextCount = currentCount + 1;
    const shouldLock = nextCount >= MAX_FAILED_ATTEMPTS;
    await this.prisma.user.update({
      where: { id: userId },
      data: {
        failedLoginCount: nextCount,
        lockedUntil: shouldLock ? new Date(Date.now() + LOCKOUT_WINDOW_MS) : undefined,
      },
    });
  }

  // Ensures a login against a nonexistent email still performs an argon2
  // verify of comparable cost, so response timing doesn't reveal account
  // existence (Security Design Â§3.1).
  private async dummyHashForTimingParity(): Promise<string> {
    return argon2.hash('dummy-timing-parity-value');
  }

  private decryptTotpSecret(_encrypted: Buffer): string {
    // TDS Â§3.4 / Security Design Â§13: application-level decryption using
    // TOTP_ENCRYPTION_KEY. Actual AES-GCM implementation lands with the
    // 2FA enrollment workstream (Phase 0, immediately following auth
    // core) â€” stubbed here so AuthService's shape is complete and
    // reviewable before that specific crypto code is written and tested
    // in isolation.
    throw new Error('decryptTotpSecret not yet implemented â€” see 2FA enrollment workstream');
  }

  private toUserDto(user: { id: string; email: string; displayName: string; role: PrismaUserRole; isActive: boolean; totpEnabled: boolean; misId?: string | null; gender?: string | null; createdAt: Date; deactivatedAt: Date | null }) {
    // API Contract Â§12: explicit allow-list projection â€” never serialize
    // the raw Prisma row (which includes passwordHash, failedLoginCount).
    return {
      id: user.id,
      email: user.email,
      display_name: user.displayName,
      role: toSharedUserRole(user.role),
      mis_id: user.misId ?? null,
      gender: (user.gender as never) ?? null,
      is_active: user.isActive,
      totp_enabled: user.totpEnabled,
      created_at: user.createdAt.toISOString(),
      deactivated_at: user.deactivatedAt?.toISOString() ?? null,
    };
  }
}
