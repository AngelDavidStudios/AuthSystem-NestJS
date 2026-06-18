import {
  isSessionVisibleToSystem,
  normalizeSystem,
  type SystemId,
} from '../../src/auth/system-access.util';

describe('system-access.util', () => {
  describe('normalizeSystem', () => {
    it('acepta "A" y "B"', () => {
      expect(normalizeSystem('A')).toBe('A');
      expect(normalizeSystem('B')).toBe('B');
    });

    it('devuelve undefined para cualquier otro valor', () => {
      expect(normalizeSystem(undefined)).toBeUndefined();
      expect(normalizeSystem('')).toBeUndefined();
      expect(normalizeSystem('a')).toBeUndefined();
      expect(normalizeSystem('C')).toBeUndefined();
    });
  });

  describe('isSessionVisibleToSystem', () => {
    const user = (groups: string[], loginOrigin?: SystemId) => ({
      groups,
      loginOrigin,
    });

    it('usuarios NO-admin son visibles en ambos sistemas (SSO)', () => {
      const u = user(['Users'], 'A');
      expect(isSessionVisibleToSystem(u, 'A')).toBe(true);
      expect(isSessionVisibleToSystem(u, 'B')).toBe(true);
    });

    it('Managers NO se confinan: SSO en ambos sistemas (solo Admins se confina)', () => {
      const managerFromA = user(['Managers'], 'A');
      expect(isSessionVisibleToSystem(managerFromA, 'A')).toBe(true);
      expect(isSessionVisibleToSystem(managerFromA, 'B')).toBe(true);
    });

    it('usuario sin grupos es visible en ambos', () => {
      const u = user([], 'B');
      expect(isSessionVisibleToSystem(u, 'A')).toBe(true);
      expect(isSessionVisibleToSystem(u, 'B')).toBe(true);
    });

    it('admin solo es visible en su sistema de origen', () => {
      const adminFromA = user(['Admins'], 'A');
      expect(isSessionVisibleToSystem(adminFromA, 'A')).toBe(true);
      expect(isSessionVisibleToSystem(adminFromA, 'B')).toBe(false);

      const adminFromB = user(['Admins'], 'B');
      expect(isSessionVisibleToSystem(adminFromB, 'B')).toBe(true);
      expect(isSessionVisibleToSystem(adminFromB, 'A')).toBe(false);
    });

    it('un llamador sin cabecera X-System válida no confina (Postman/Bearer)', () => {
      const adminFromA = user(['Admins'], 'A');
      expect(isSessionVisibleToSystem(adminFromA, undefined)).toBe(true);
      expect(isSessionVisibleToSystem(adminFromA, 'C')).toBe(true);
    });

    it('admin con varios grupos incluyendo Admins también se confina', () => {
      const u = user(['Users', 'Admins'], 'A');
      expect(isSessionVisibleToSystem(u, 'B')).toBe(false);
      expect(isSessionVisibleToSystem(u, 'A')).toBe(true);
    });
  });
});
