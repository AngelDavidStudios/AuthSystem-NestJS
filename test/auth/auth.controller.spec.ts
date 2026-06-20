import { UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Request, Response } from 'express';
import { AuthController } from '../../src/auth/auth.controller';
import { AuthService } from '../../src/auth/auth.service';
import type { Env } from '../../src/config/env.schema';

const URL_A = 'https://a.example';
const URL_B = 'https://b.example';

const config = {
  get: (key: keyof Env) =>
    key === 'FRONTEND_URL_A'
      ? URL_A
      : key === 'FRONTEND_URL_B'
        ? URL_B
        : key === 'ALLOWED_ORIGINS'
          ? `${URL_A},${URL_B}`
          : undefined,
} as unknown as ConfigService<Env, true>;

function makeAuthService() {
  return {
    generateState: jest.fn().mockReturnValue('state-123'),
    buildAuthorizeUrl: jest.fn((s: string) => `https://cognito/authorize?state=${s}`),
    buildLogoutUrl: jest.fn((uri: string) => `https://cognito/logout?uri=${uri}`),
    exchangeCodeForTokens: jest.fn().mockResolvedValue({
      id_token: 'idt',
      refresh_token: 'rt',
      expires_in: 3600,
    }),
    decodeIdToken: jest.fn().mockReturnValue({
      sub: 'sub-1',
      email: 'jdoe@example.com',
      name: 'John Doe',
      'cognito:username': 'jdoe',
      'cognito:groups': ['Users'],
    }),
    refreshTokens: jest.fn().mockResolvedValue({
      refresh_token: 'rt2',
      expires_in: 1800,
    }),
  } as unknown as AuthService;
}

interface FakeSession {
  user?: unknown;
  tokens?: unknown;
  oauth?: unknown;
  save: jest.Mock;
  destroy: jest.Mock;
}

function makeReq(session: Partial<FakeSession> = {}): Request & {
  session: FakeSession;
} {
  return {
    session: {
      save: jest.fn().mockResolvedValue(undefined),
      destroy: jest.fn(),
      ...session,
    },
  } as unknown as Request & { session: FakeSession };
}

const makeRes = () => ({ redirect: jest.fn() }) as unknown as Response;

function makeController() {
  const auth = makeAuthService();
  return { controller: new AuthController(auth, config), auth };
}

describe('AuthController (BFF OIDC)', () => {
  describe('login', () => {
    it('resetea sesión previa, guarda oauth y redirige a Cognito', async () => {
      const { controller, auth } = makeController();
      const req = makeReq({ user: { old: true }, tokens: { old: true } });
      const res = makeRes();

      await controller.login('A', undefined, req, res);

      expect(req.session.user).toBeUndefined();
      expect(req.session.tokens).toBeUndefined();
      expect(req.session.oauth).toEqual({
        state: 'state-123',
        returnTo: URL_A,
        origin: 'A',
      });
      expect(req.session.save).toHaveBeenCalled();
      expect(res.redirect).toHaveBeenCalledWith(
        'https://cognito/authorize?state=state-123',
      );
      expect(auth.generateState).toHaveBeenCalled();
    });

    it('acepta un return_to absoluto dentro de la allowlist (origin B)', async () => {
      const { controller } = makeController();
      const req = makeReq();
      await controller.login('B', `${URL_B}/dashboard`, req, makeRes());
      expect((req.session.oauth as { returnTo: string }).returnTo).toBe(
        `${URL_B}/dashboard`,
      );
    });

    it('cuelga un return_to relativo del frontend del origin', async () => {
      const { controller } = makeController();
      const req = makeReq();
      await controller.login('A', 'profile', req, makeRes());
      expect((req.session.oauth as { returnTo: string }).returnTo).toBe(
        `${URL_A}/profile`,
      );
    });

    it('ignora un return_to absoluto fuera de la allowlist → base', async () => {
      const { controller } = makeController();
      const req = makeReq();
      await controller.login('A', 'https://evil.example/x', req, makeRes());
      expect((req.session.oauth as { returnTo: string }).returnTo).toBe(URL_A);
    });
  });

  describe('callback', () => {
    const oauth = { state: 'state-123', returnTo: `${URL_A}/home`, origin: 'A' };

    it('intercambia el code, puebla la sesión y redirige a returnTo', async () => {
      const { controller } = makeController();
      const req = makeReq({ oauth });
      const res = makeRes();

      await controller.callback('code-1', 'state-123', undefined, req, res);

      expect(req.session.user).toMatchObject({
        sub: 'sub-1',
        username: 'jdoe',
        groups: ['Users'],
        loginOrigin: 'A',
      });
      expect(req.session.tokens).toMatchObject({ refreshToken: 'rt' });
      expect(req.session.oauth).toBeUndefined();
      expect(res.redirect).toHaveBeenCalledWith(`${URL_A}/home`);
    });

    it('lanza si Cognito devuelve error', async () => {
      const { controller } = makeController();
      await expect(
        controller.callback(undefined, undefined, 'access_denied', makeReq(), makeRes()),
      ).rejects.toBeInstanceOf(UnauthorizedException);
    });

    it('lanza si falta code o state', async () => {
      const { controller } = makeController();
      await expect(
        controller.callback(undefined, 'state-123', undefined, makeReq({ oauth }), makeRes()),
      ).rejects.toBeInstanceOf(UnauthorizedException);
    });

    it('lanza si el state no coincide (CSRF)', async () => {
      const { controller } = makeController();
      await expect(
        controller.callback('code-1', 'WRONG', undefined, makeReq({ oauth }), makeRes()),
      ).rejects.toBeInstanceOf(UnauthorizedException);
    });
  });

  describe('logout', () => {
    it('destruye la sesión y devuelve el logoutUrl de Cognito', () => {
      const { controller } = makeController();
      const req = makeReq();
      const result = controller.logout('A', undefined, req);
      expect(req.session.destroy).toHaveBeenCalled();
      expect(result.logoutUrl).toBe(`https://cognito/logout?uri=${URL_A}`);
    });

    it('usa el origen de return_to si está permitido', () => {
      const { controller } = makeController();
      const result = controller.logout('B', `${URL_B}/bye`, makeReq());
      expect(result.logoutUrl).toBe(`https://cognito/logout?uri=${URL_B}`);
    });
  });

  describe('getSession', () => {
    it('devuelve authenticated:true para un usuario normal', () => {
      const { controller } = makeController();
      const user = { sub: 's', groups: ['Users'], username: 'jdoe' };
      const result = controller.getSession(makeReq({ user }), undefined);
      expect(result).toEqual({ authenticated: true, user });
    });

    it('devuelve authenticated:false si no hay sesión', () => {
      const { controller } = makeController();
      expect(controller.getSession(makeReq(), undefined)).toEqual({
        authenticated: false,
      });
    });

    it('confina al Admin: invisible desde un sistema distinto a su origen', () => {
      const { controller } = makeController();
      const admin = {
        sub: 's',
        groups: ['Admins'],
        username: 'boss',
        loginOrigin: 'A',
      };
      // Admin logueado en A, consultando desde B → no visible.
      expect(controller.getSession(makeReq({ user: admin }), 'B')).toEqual({
        authenticated: false,
      });
      // Desde su propio sistema sí.
      expect(
        controller.getSession(makeReq({ user: admin }), 'A').authenticated,
      ).toBe(true);
    });
  });

  describe('verify-token / me', () => {
    it('verifyToken devuelve los claims del request', () => {
      const { controller } = makeController();
      const claims = { sub: 's', email: 'x', groups: [] };
      const req = { user: claims } as unknown as Request & { user: typeof claims };
      expect(controller.verifyToken(req)).toEqual({ valid: true, claims });
    });

    it('me devuelve el user de la sesión', () => {
      const { controller } = makeController();
      const user = { sub: 's', username: 'jdoe' };
      expect(controller.me(makeReq({ user }))).toEqual(user);
    });
  });

  describe('refresh', () => {
    it('refresca tokens y persiste el nuevo refreshToken', async () => {
      const { controller } = makeController();
      const req = makeReq({
        user: { username: 'jdoe' },
        tokens: { refreshToken: 'rt', expiresAt: 1 },
      });
      const result = await controller.refresh(req);
      expect(result).toEqual({ ok: true, expiresIn: 1800 });
      expect((req.session.tokens as { refreshToken: string }).refreshToken).toBe(
        'rt2',
      );
      expect(req.session.save).toHaveBeenCalled();
    });

    it('lanza si la sesión no tiene tokens', async () => {
      const { controller } = makeController();
      await expect(
        controller.refresh(makeReq({ user: { username: 'jdoe' } })),
      ).rejects.toBeInstanceOf(UnauthorizedException);
    });
  });
});
