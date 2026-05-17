import '../../session/session.types';
import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { Request } from 'express';
import { ROLES_KEY } from '../decorators/roles.decorator';
import type { AuthenticatedUser } from '../../auth/strategies/cognito-jwt.strategy';

interface RequestWithUser extends Request {
  user?: AuthenticatedUser;
}

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const requiredRoles = this.reflector.getAllAndOverride<string[]>(
      ROLES_KEY,
      [context.getHandler(), context.getClass()],
    );

    if (!requiredRoles || requiredRoles.length === 0) {
      return true;
    }

    const req = context.switchToHttp().getRequest<RequestWithUser>();
    const userGroups = req.session?.user?.groups ?? req.user?.groups ?? [];

    const hasRole = requiredRoles.some((role) => userGroups.includes(role));
    if (!hasRole) {
      throw new ForbiddenException(
        `Requires one of the following Cognito groups: ${requiredRoles.join(', ')}`,
      );
    }
    return true;
  }
}
