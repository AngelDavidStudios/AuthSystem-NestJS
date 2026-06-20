import { ConfigService } from '@nestjs/config';
import { buildSessionOptions } from '../../src/session/session.options';
import type { Env } from '../../src/config/env.schema';

function config(nodeEnv: string): ConfigService<Env, true> {
  const values: Partial<Record<keyof Env, string>> = {
    NODE_ENV: nodeEnv,
    SESSION_COOKIE_NAME: 'wfn_session',
    SESSION_SECRET: 'x'.repeat(32),
  };
  return {
    get: (key: keyof Env) => values[key],
  } as unknown as ConfigService<Env, true>;
}

describe('buildSessionOptions', () => {
  it('en producción usa cookie Secure + SameSite=None (cross-site SPAs)', () => {
    const opts = buildSessionOptions(config('production'));
    expect(opts.cookieName).toBe('wfn_session');
    expect(opts.cookieOptions).toMatchObject({
      httpOnly: true,
      secure: true,
      sameSite: 'none',
      path: '/',
      maxAge: 60 * 60 * 8,
    });
  });

  it('en local usa SameSite=Lax sin Secure', () => {
    const opts = buildSessionOptions(config('development'));
    expect(opts.cookieOptions).toMatchObject({
      secure: false,
      sameSite: 'lax',
    });
  });
});
