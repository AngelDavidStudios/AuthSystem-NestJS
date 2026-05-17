import 'iron-session';
import type { IronSession, IronSessionData } from 'iron-session';

declare module 'iron-session' {
  interface IronSessionData {
    user?: {
      sub: string;
      email?: string;
      username?: string;
      groups: string[];
    };
    tokens?: {
      idToken: string;
      accessToken: string;
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
