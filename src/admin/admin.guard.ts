import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import type { Request } from 'express';

import { ADMIN_ROLE, type AdminTokenPayload } from './admin-token.type';

// Applicants and admins are signed with the same secret, so the `role` claim is what keeps an
// applicant's token out of the /admin routes.
@Injectable()
export class AdminGuard implements CanActivate {
  constructor(private readonly jwtService: JwtService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<Request>();
    const [scheme, token] = request.headers.authorization?.split(' ') ?? [];

    if (scheme !== 'Bearer' || !token) {
      throw new UnauthorizedException('Missing access token');
    }

    let payload: Partial<AdminTokenPayload>;
    try {
      payload =
        await this.jwtService.verifyAsync<Partial<AdminTokenPayload>>(token);
    } catch {
      throw new UnauthorizedException('Invalid or expired access token');
    }

    if (payload.role !== ADMIN_ROLE) {
      throw new ForbiddenException('Admin access only');
    }
    return true;
  }
}
