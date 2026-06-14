import { ForbiddenException, type ExecutionContext } from '@nestjs/common';
import type { Request } from 'express';
import { SystemAccessGuard } from '../../../src/auth/guards/system-access.guard';

describe('SystemAccessGuard', () => {
  const guard = new SystemAccessGuard();

  function contextFor(
    user: { groups: string[]; loginOrigin?: 'A' | 'B' } | undefined,
    xSystem?: string,
  ): ExecutionContext {
    const req = {
      session: { user },
      header: (name: string) =>
        name.toLowerCase() === 'x-system' ? xSystem : undefined,
    } as unknown as Request;

    return {
      switchToHttp: () => ({ getRequest: () => req }),
    } as unknown as ExecutionContext;
  }

  it('deja pasar cuando no hay sesión (ruta Bearer/Postman)', () => {
    expect(guard.canActivate(contextFor(undefined, 'B'))).toBe(true);
  });

  it('deja pasar a un usuario no-admin en cualquier sistema', () => {
    const u = { groups: ['Users'], loginOrigin: 'A' as const };
    expect(guard.canActivate(contextFor(u, 'A'))).toBe(true);
    expect(guard.canActivate(contextFor(u, 'B'))).toBe(true);
  });

  it('deja pasar a un admin en su sistema de origen', () => {
    const u = { groups: ['Admins'], loginOrigin: 'A' as const };
    expect(guard.canActivate(contextFor(u, 'A'))).toBe(true);
  });

  it('bloquea a un admin que opera desde otro sistema', () => {
    const u = { groups: ['Admins'], loginOrigin: 'A' as const };
    expect(() => guard.canActivate(contextFor(u, 'B'))).toThrow(
      ForbiddenException,
    );
  });

  it('no confina cuando falta la cabecera X-System', () => {
    const u = { groups: ['Admins'], loginOrigin: 'A' as const };
    expect(guard.canActivate(contextFor(u, undefined))).toBe(true);
  });
});
