import { ConfigService } from '@nestjs/config';
import type { Env } from './env.schema';

/**
 * Lista efectiva de orígenes permitidos: ALLOWED_ORIGINS (separados por comas)
 * más FRONTEND_URL_A y FRONTEND_URL_B (siempre incluidos como defaults). Se usa
 * tanto para el CORS como para validar `return_to`/`logout_uri`, de modo que
 * agregar un frontend nuevo (localhost de un compañero, Netlify, Vercel) sea
 * solo añadir su origen al env, sin tocar código.
 */
export function buildAllowlist(config: ConfigService<Env, true>): string[] {
  const raw = config.get('ALLOWED_ORIGINS', { infer: true });
  const extra = raw
    .split(',')
    .map((o) => o.trim())
    .filter(Boolean);
  const a = config.get('FRONTEND_URL_A', { infer: true });
  const b = config.get('FRONTEND_URL_B', { infer: true });
  return Array.from(new Set([...extra, a, b]));
}

/** True si la URL dada tiene un origen presente en la allowlist. */
export function isOriginAllowed(allowlist: string[], url: string): boolean {
  try {
    return allowlist.includes(new URL(url).origin);
  } catch {
    return false;
  }
}
