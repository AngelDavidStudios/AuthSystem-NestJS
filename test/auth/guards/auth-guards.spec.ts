import {
  ExecutionContext,
  ForbiddenException,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { RolesGuard } from '../../../src/roles/guards/roles.guard';
import { SessionAuthGuard } from '../../../src/auth/guards/session-auth.guard';
import { HybridAuthGuard } from '../../../src/auth/guards/hybrid-auth.guard';
import { JwtAuthGuard } from '../../../src/auth/guards/jwt-auth.guard';

function ctx(req: unknown): ExecutionContext {
  return {
    switchToHttp: () => ({ getRequest: () => req }),
    getHandler: () => null,
    getClass: () => null,
  } as unknown as ExecutionContext;
}

describe('RolesGuard', () => {
  function guardWith(required: string[] | undefined) {
    const reflector = {
      getAllAndOverride: jest.fn().mockReturnValue(required),
    } as unknown as Reflector;
    return new RolesGuard(reflector);
  }

  it('permite si el handler no declara roles', () => {
    expect(guardWith(undefined).canActivate(ctx({}))).toBe(true);
    expect(guardWith([]).canActivate(ctx({}))).toBe(true);
  });

  it('permite si el usuario de sesión tiene el grupo requerido', () => {
    const req = { session: { user: { groups: ['Admins'] } } };
    expect(guardWith(['Admins']).canActivate(ctx(req))).toBe(true);
  });

  it('usa req.user (Bearer) como fallback de grupos', () => {
    const req = { user: { groups: ['Admins'] } };
    expect(guardWith(['Admins']).canActivate(ctx(req))).toBe(true);
  });

  it('lanza Forbidden si no tiene ninguno de los grupos', () => {
    const req = { session: { user: { groups: ['Users'] } } };
    expect(() => guardWith(['Admins']).canActivate(ctx(req))).toThrow(
      ForbiddenException,
    );
  });
});

describe('SessionAuthGuard', () => {
  const guard = new SessionAuthGuard();

  it('permite con sesión activa', () => {
    expect(guard.canActivate(ctx({ session: { user: { sub: 's' } } }))).toBe(
      true,
    );
  });

  it('lanza Unauthorized sin sesión', () => {
    expect(() => guard.canActivate(ctx({ session: {} }))).toThrow(
      UnauthorizedException,
    );
  });
});

describe('HybridAuthGuard', () => {
  it('permite por cookie sin tocar el JwtGuard', async () => {
    const jwt = { canActivate: jest.fn() } as unknown as JwtAuthGuard;
    const guard = new HybridAuthGuard(jwt);
    const ok = await guard.canActivate(ctx({ session: { user: { sub: 's' } } }));
    expect(ok).toBe(true);
    expect(jwt.canActivate).not.toHaveBeenCalled();
  });

  it('delega en el JwtGuard (Bearer) si no hay cookie', async () => {
    const jwt = {
      canActivate: jest.fn().mockResolvedValue(true),
    } as unknown as JwtAuthGuard;
    const guard = new HybridAuthGuard(jwt);
    const ok = await guard.canActivate(ctx({ session: {} }));
    expect(ok).toBe(true);
    expect(jwt.canActivate).toHaveBeenCalled();
  });
});
