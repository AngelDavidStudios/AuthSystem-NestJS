import './session.types';
import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import type { IronSession, IronSessionData } from 'iron-session';
import type { Request } from 'express';

export const Session = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): IronSession<IronSessionData> => {
    const req = ctx.switchToHttp().getRequest<Request>();
    return req.session;
  },
);

export const SessionUser = createParamDecorator(
  (
    _data: unknown,
    ctx: ExecutionContext,
  ): IronSessionData['user'] | undefined => {
    const req = ctx.switchToHttp().getRequest<Request>();
    return req.session.user;
  },
);
