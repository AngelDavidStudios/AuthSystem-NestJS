import '../../session/session.types';
import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import type { Request } from 'express';
import type { AuthenticatedUser } from '../strategies/cognito-jwt.strategy';

export interface CurrentUserData {
  sub: string;
  email?: string;
  // Nombre legible (claim `name`). Solo presente vía sesión; en Bearer (JWT) no
  // se extrae, así que puede venir undefined.
  name?: string;
  username?: string;
  groups: string[];
}

interface RequestWithUser extends Request {
  user?: AuthenticatedUser;
}

export const CurrentUser = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): CurrentUserData | undefined => {
    const req = ctx.switchToHttp().getRequest<RequestWithUser>();
    if (req.session?.user) {
      return req.session.user;
    }
    if (req.user) {
      return {
        sub: req.user.sub,
        email: req.user.email,
        username: req.user.username,
        groups: req.user.groups,
      };
    }
    return undefined;
  },
);
