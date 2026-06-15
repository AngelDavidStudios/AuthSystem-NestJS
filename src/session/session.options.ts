import { ConfigService } from '@nestjs/config';
import type { SessionOptions } from 'iron-session';
import type { Env } from '../config/env.schema';

export function buildSessionOptions(
  config: ConfigService<Env, true>,
): SessionOptions {
  const isProd = config.get('NODE_ENV', { infer: true }) === 'production';

  return {
    cookieName: config.get('SESSION_COOKIE_NAME', { infer: true }),
    password: config.get('SESSION_SECRET', { infer: true }),
    cookieOptions: {
      httpOnly: true,
      secure: isProd,
      // En prod el backend (Lambda HTTPS) es cross-site respecto a los SPAs
      // (localhost) → la cookie debe ser SameSite=None (requiere Secure) para
      // viajar en XHR cross-origin. En local todo es localhost → Lax basta.
      sameSite: isProd ? 'none' : 'lax',
      path: '/',
      maxAge: 60 * 60 * 8,
    },
  };
}
