import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';

import type { AuthenticatedRequest } from './authenticated-user.type';

// Opt-in per route/controller with @UseGuards(JwtAuthGuard); nothing is protected globally.
@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(private readonly jwtService: JwtService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const [scheme, token] = request.headers.authorization?.split(' ') ?? [];

    if (scheme !== 'Bearer' || !token) {
      throw new UnauthorizedException('Missing access token');
    }

    try {
      const payload = await this.jwtService.verifyAsync<{
        sub: string;
        email: string;
      }>(token);
      request.user = { id: payload.sub, email: payload.email };
    } catch {
      throw new UnauthorizedException('Invalid or expired access token');
    }

    return true;
  }
}
