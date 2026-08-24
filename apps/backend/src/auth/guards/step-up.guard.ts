import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { REQUIRE_STEP_UP_KEY } from '../decorators/require-step-up.decorator';
import { ApiExceptions } from '../../common/dto/api-exception';
import { AuthenticatedRequest } from './session-auth.guard';

const STEP_UP_FRESHNESS_MS = 5 * 60 * 1000; // TDS §12.3 — 5 minute window.

// TDS §12.3 / Security Design §17 Criterion applies here: a route marked
// @RequireStepUp() rejects with STEP_UP_REQUIRED unless the session has a
// step_up_verified_at timestamp within the freshness window. This protects
// the specific high-consequence action set even against a hijacked-but-
// still-valid session (Security Design §3.1 threat: "hijacked-session
// abuse of high-consequence actions").
@Injectable()
export class StepUpGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const required = this.reflector.getAllAndOverride<boolean>(REQUIRE_STEP_UP_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (!required) return true;

    const { stepUpVerifiedAt } = context.switchToHttp().getRequest<AuthenticatedRequest>();
    if (!stepUpVerifiedAt || Date.now() - stepUpVerifiedAt.getTime() > STEP_UP_FRESHNESS_MS) {
      throw ApiExceptions.stepUpRequired();
    }
    return true;
  }
}
