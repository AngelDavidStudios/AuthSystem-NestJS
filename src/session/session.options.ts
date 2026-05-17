import { ConfigService } from '@nestjs/config';
import type { SessionOptions } from 'iron-session';
import type { Env } from '../config/env.schema';

export function buildSessionOptions(
  config: ConfigService<Env, true>,
): SessionOptions {
  return {
    cookieName: config.get('SESSION_COOKIE_NAME', { infer: true }),
    password: config.get('SESSION_SECRET', { infer: true }),
    cookieOptions: {
      httpOnly: true,
      secure: config.get('NODE_ENV', { infer: true }) === 'production',
      sameSite: 'lax',
      path: '/',
      maxAge: 60 * 60 * 8,
    },
  };
}
