import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Request } from 'express';
import { IS_PUBLIC_KEY } from '../../common/decorators/public.decorator';
import { ApiExceptions } from '../../common/dto/api-exception';
import { PrismaService } from '../../prisma/prisma.service';
import { hashToken } from '../../common/security/hash-token.util';
import { toSharedUserRole } from '../../common/mappers/user-role.mapper';
import { UserRole } from '@nest/shared-types';

export interface SessionUser {
  id: string;
  role: UserRole;
  isActive: boolean;
}

export interface AuthenticatedRequest extends Request {
  user: SessionUser;
  sessionId: string;
  stepUpVerifiedAt: Date | null;
}

// Runs on every route unless @Public() is present (API Contract §2).
// Security Design §5: a session, once revoked or expired, cannot be used
// again — checked on every request, not cached. Deactivation
// (Security Acceptance Criterion #13) takes effect on the very next
// request because `user.isActive` is re-read from the database here,
// never trusted from a stale claim inside the session/cookie itself.
@Injectable()
export class SessionAuthGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly prisma: PrismaService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) return true;

    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const cookieName = process.env.SESSION_COOKIE_NAME ?? 'nest_session';
    const rawToken: string | undefined = request.cookies?.[cookieName];

    if (!rawToken) throw ApiExceptions.sessionExpired();

    const sessionId = hashToken(rawToken);
    const session = await this.prisma.session.findUnique({
      where: { id: sessionId },
      include: { user: true },
    });

    if (!session || session.revokedAt || session.expiresAt < new Date()) {
      throw ApiExceptions.sessionExpired();
    }

    // Security Acceptance Criterion #13 — re-checked on every request.
    if (!session.user.isActive) {
      throw ApiExceptions.sessionExpired();
    }

    request.user = {
      id: session.user.id,
      role: toSharedUserRole(session.user.role),
      isActive: session.user.isActive,
    };
    request.sessionId = session.id;
    request.stepUpVerifiedAt = session.stepUpVerifiedAt;

    // TDS §3.3: updated at most once per minute to avoid write amplification.
    const staleBy = Date.now() - session.lastSeenAt.getTime();
    if (staleBy > 60_000) {
      await this.prisma.session.update({
        where: { id: session.id },
        data: { lastSeenAt: new Date() },
      });
    }

    return true;
  }
}
