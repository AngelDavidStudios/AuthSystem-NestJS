import { Injectable, NestMiddleware } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { getIronSession } from 'iron-session';
import type { IronSession, IronSessionData } from 'iron-session';
import { NextFunction, Request, Response } from 'express';
import type { Env } from '../config/env.schema';
import { buildSessionOptions } from './session.options';

declare module 'express-serve-static-core' {
  interface Request {
    session: IronSession<IronSessionData>;
  }
}

@Injectable()
export class IronSessionMiddleware implements NestMiddleware {
  constructor(private readonly config: ConfigService<Env, true>) {}

  async use(req: Request, res: Response, next: NextFunction): Promise<void> {
    req.session = await getIronSession<IronSessionData>(
      req,
      res,
      buildSessionOptions(this.config),
    );
    next();
  }
}
