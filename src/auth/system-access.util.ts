export type SystemId = 'A' | 'B';

/** Normaliza la cabecera `X-System` a 'A' | 'B' (o undefined si no aplica). */
export function normalizeSystem(raw?: string): SystemId | undefined {
  return raw === 'A' || raw === 'B' ? raw : undefined;
}

interface SessionUserLike {
  groups: string[];
  loginOrigin?: SystemId;
}

/**
 * Confinamiento por sistema de origen.
 *
 * El confinamiento depende SOLO del grupo `Admins`:
 * - `Users` y `Managers` (y cualquier no-admin): visibles en ambos sistemas
 *   (SSO completo). Aunque `Managers` se mapea a "admin" en la UI del frontend,
 *   NO se confina aquí; solo el grupo Cognito `Admins` lo hace.
 * - `Admins`: solo visibles en el sistema por el que iniciaron sesión
 *   (`loginOrigin`). El otro SPA los trata como no autenticados → se queda en
 *   login. Un Admin sí puede iniciar sesión directo en cualquiera de los dos.
 *
 * Si el llamador no se identifica como A/B (p.ej. Postman/Bearer), no se aplica
 * confinamiento.
 */
export function isSessionVisibleToSystem(
  user: SessionUserLike,
  systemRaw?: string,
): boolean {
  const isAdmin = user.groups.includes('Admins');
  if (!isAdmin) return true;
  const system = normalizeSystem(systemRaw);
  if (!system) return true;
  return user.loginOrigin === system;
}
