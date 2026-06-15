import { ConfigService } from '@nestjs/config';
import { buildAllowlist, isOriginAllowed } from '../../src/config/origins';
import type { Env } from '../../src/config/env.schema';

function configWith(
  values: Partial<Record<keyof Env, string>>,
): ConfigService<Env, true> {
  return {
    get: (key: keyof Env) => values[key],
  } as unknown as ConfigService<Env, true>;
}

describe('config/origins', () => {
  describe('buildAllowlist', () => {
    it('combina ALLOWED_ORIGINS con FRONTEND_URL_A/B y deduplica', () => {
      const config = configWith({
        ALLOWED_ORIGINS:
          'http://localhost:5173, https://a.netlify.app , https://b.vercel.app',
        FRONTEND_URL_A: 'http://localhost:5173',
        FRONTEND_URL_B: 'http://localhost:5174',
      });
      expect(buildAllowlist(config).sort()).toEqual(
        [
          'http://localhost:5173',
          'http://localhost:5174',
          'https://a.netlify.app',
          'https://b.vercel.app',
        ].sort(),
      );
    });

    it('con ALLOWED_ORIGINS vacío deja solo FRONTEND_URL_A/B', () => {
      const config = configWith({
        ALLOWED_ORIGINS: '',
        FRONTEND_URL_A: 'http://localhost:5173',
        FRONTEND_URL_B: 'http://localhost:5174',
      });
      expect(buildAllowlist(config).sort()).toEqual([
        'http://localhost:5173',
        'http://localhost:5174',
      ]);
    });
  });

  describe('isOriginAllowed', () => {
    const allow = ['http://localhost:5173', 'https://a.netlify.app'];

    it('acepta una URL cuyo origen está en la lista', () => {
      expect(isOriginAllowed(allow, 'https://a.netlify.app/post-login')).toBe(
        true,
      );
    });

    it('rechaza un origen ausente o una URL inválida', () => {
      expect(isOriginAllowed(allow, 'https://evil.com/x')).toBe(false);
      expect(isOriginAllowed(allow, 'no-es-url')).toBe(false);
    });
  });
});
