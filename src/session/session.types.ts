import 'iron-session';

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

export {};
