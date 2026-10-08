import { createParamDecorator, ExecutionContext } from '@nestjs/common';

import type {
  AuthenticatedRequest,
  AuthenticatedUser,
} from './authenticated-user.type';

// Only valid on routes behind JwtAuthGuard, which is what sets request.user.
export const CurrentUser = createParamDecorator(
  (_data: unknown, context: ExecutionContext): AuthenticatedUser =>
    context.switchToHttp().getRequest<AuthenticatedRequest>().user,
);
