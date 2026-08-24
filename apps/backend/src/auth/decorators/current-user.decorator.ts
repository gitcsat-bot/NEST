import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { AuthenticatedRequest } from '../guards/session-auth.guard';

// Pulls the user attached to the request by SessionAuthGuard. Only valid
// on routes that guard runs on (i.e., not @Public() routes).
export const CurrentUser = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext) => {
    const request = ctx.switchToHttp().getRequest<AuthenticatedRequest>();
    return request.user;
  },
);
