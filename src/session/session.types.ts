import 'iron-session';
import type { IronSession, IronSessionData } from 'iron-session';

declare module 'iron-session' {
  interface IronSessionData {
    user?: {
      sub: string;
      email?: string;
      // Nombre legible (claim `name`); se prefiere al `username` para la UI.
      name?: string;
      username?: string;
      groups: string[];
      // Sistema por el que el usuario inició sesión (A o B). Los Admins quedan
      // confinados a este sistema: el otro SPA los ve como NO autenticados
      // (se queda en login). Los usuarios no-admin conservan SSO en ambos.
      loginOrigin: 'A' | 'B';
    };
    tokens?: {
      // Only the refresh_token is kept in the session because:
      //   - id_token claims were already extracted into `user` on callback
      //   - access_token is unused (Sistema C calls Cognito Admin API with IAM,
      //     not with the user's access token)
      // Storing all three pushes the encrypted cookie past the browser's
      // ~4KB hard limit. Keeping only the refresh_token also makes /auth/refresh
      // possible without re-doing the OIDC dance.
      refreshToken: string;
      expiresAt: number;
    };
    oauth?: {
      state: string;
      returnTo: string;
      origin: 'A' | 'B';
    };
  }
}

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      session: IronSession<IronSessionData>;
    }
  }
}

export {};
