import '../../session/session.types';
import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import type { Request } from 'express';
import { JwtAuthGuard } from './jwt-auth.guard';

/**
 * Accepts either:
 *   - an active iron-session cookie (`req.session.user`), or
 *   - a valid Cognito Bearer token (validated via passport-jwt).
 *
 * Use on endpoints that must be callable from SPAs (cookie) AND from
 * server-to-server clients or Postman (Bearer).
 */
@Injectable()
export class HybridAuthGuard implements CanActivate {
  constructor(private readonly jwtGuard: JwtAuthGuard) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const req = context.switchToHttp().getRequest<Request>();
    if (req.session?.user) {
      return true;
    }
    const result = await Promise.resolve(this.jwtGuard.canActivate(context));
    return result as boolean;
  }
}
