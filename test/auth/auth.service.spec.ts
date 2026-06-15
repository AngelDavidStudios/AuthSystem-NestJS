import { BadRequestException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AuthService } from '../../src/auth/auth.service';
import type { Env } from '../../src/config/env.schema';

const ENV: Partial<Record<keyof Env, string>> = {
  COGNITO_REGION: 'us-east-1',
  COGNITO_CLIENT_ID: 'client123',
  COGNITO_CLIENT_SECRET: 'secret456',
  COGNITO_DOMAIN: 'sistema-c-auth.auth.us-east-1.amazoncognito.com',
  COGNITO_REDIRECT_URI: 'http://localhost:3000/auth/callback',
  FRONTEND_URL_A: 'http://localhost:5173',
  FRONTEND_URL_B: 'http://localhost:5174',
};

function makeService(): AuthService {
  const config = {
    get: (key: keyof Env) => ENV[key],
  } as unknown as ConfigService<Env, true>;
  return new AuthService(config);
}

describe('AuthService', () => {
  let service: AuthService;

  beforeEach(() => {
    service = makeService();
  });

  describe('generateState', () => {
    it('genera un state hex de 64 chars (32 bytes) y distinto cada vez', () => {
      const a = service.generateState();
      const b = service.generateState();
      expect(a).toMatch(/^[0-9a-f]{64}$/);
      expect(a).not.toBe(b);
    });
  });

  describe('buildAuthorizeUrl', () => {
    it('arma la URL de /oauth2/authorize con scope y params correctos', () => {
      const url = new URL(service.buildAuthorizeUrl('xyz-state'));
      expect(url.origin + url.pathname).toBe(
        'https://sistema-c-auth.auth.us-east-1.amazoncognito.com/oauth2/authorize',
      );
      expect(url.searchParams.get('response_type')).toBe('code');
      expect(url.searchParams.get('client_id')).toBe('client123');
      expect(url.searchParams.get('redirect_uri')).toBe(
        'http://localhost:3000/auth/callback',
      );
      expect(url.searchParams.get('scope')).toBe('openid email profile');
      expect(url.searchParams.get('state')).toBe('xyz-state');
    });
  });

  describe('buildLogoutUrl', () => {
    it('arma la URL de /logout con el logout_uri dado', () => {
      const url = new URL(service.buildLogoutUrl('https://a.netlify.app'));
      expect(url.pathname).toBe('/logout');
      expect(url.searchParams.get('client_id')).toBe('client123');
      expect(url.searchParams.get('logout_uri')).toBe('https://a.netlify.app');
    });
  });

  describe('decodeIdToken', () => {
    it('decodifica el payload de un id_token bien formado', () => {
      const payload = {
        sub: 'user-1',
        email: 'a@b.com',
        'cognito:username': 'angel',
        'cognito:groups': ['Admins'],
        exp: 123,
        iat: 100,
        aud: 'client123',
      };
      const encoded = Buffer.from(JSON.stringify(payload)).toString(
        'base64url',
      );
      const token = `header.${encoded}.signature`;

      const claims = service.decodeIdToken(token);
      expect(claims.sub).toBe('user-1');
      expect(claims.email).toBe('a@b.com');
      expect(claims['cognito:groups']).toEqual(['Admins']);
    });

    it('lanza BadRequestException si el token está malformado', () => {
      expect(() => service.decodeIdToken('not-a-jwt')).toThrow(
        BadRequestException,
      );
    });
  });
});
