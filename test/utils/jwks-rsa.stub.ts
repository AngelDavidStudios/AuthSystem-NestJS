/**
 * Stub de `jwks-rsa` para e2e. El paquete real arrastra `jose` (ESM puro) que
 * Jest no transpila, y además solo se usa en el camino Bearer/JWKS (no se
 * ejercita en estos e2e basados en sesión). `passportJwtSecret` devuelve un
 * proveedor de clave dummy para que `CognitoJwtStrategy` se construya sin red.
 */
export function passportJwtSecret() {
  return (
    _req: unknown,
    _rawJwtToken: unknown,
    done: (err: Error | null, secret?: string) => void,
  ): void => done(null, 'test-secret');
}
