import {
  BadRequestException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  AuthFlowType,
  CognitoIdentityProviderClient,
  InitiateAuthCommand,
  NotAuthorizedException,
} from '@aws-sdk/client-cognito-identity-provider';
import { createHmac, randomBytes } from 'crypto';
import type { Env } from '../config/env.schema';

export interface CognitoTokenSet {
  id_token: string;
  access_token: string;
  refresh_token: string;
  expires_in: number;
  token_type: string;
}

export interface CognitoIdTokenPayload {
  sub: string;
  email?: string;
  // Nombre legible del usuario. En federación Google viene del mapeo name→name;
  // se prefiere sobre `cognito:username` para mostrar en UI (el username de un
  // usuario federado es del tipo `google_1128992…`).
  name?: string;
  'cognito:username'?: string;
  'cognito:groups'?: string[];
  exp: number;
  iat: number;
  aud: string;
}

@Injectable()
export class AuthService {
  private readonly cognito: CognitoIdentityProviderClient;
  private readonly clientId: string;
  private readonly clientSecret: string;
  private readonly domain: string;
  private readonly redirectUri: string;

  constructor(private readonly config: ConfigService<Env, true>) {
    this.cognito = new CognitoIdentityProviderClient({
      region: this.config.get('COGNITO_REGION', { infer: true }),
    });
    this.clientId = this.config.get('COGNITO_CLIENT_ID', { infer: true });
    this.clientSecret = this.config.get('COGNITO_CLIENT_SECRET', {
      infer: true,
    });
    this.domain = this.config.get('COGNITO_DOMAIN', { infer: true });
    this.redirectUri = this.config.get('COGNITO_REDIRECT_URI', { infer: true });
  }

  generateState(): string {
    return randomBytes(32).toString('hex');
  }

  buildAuthorizeUrl(state: string): string {
    const params = new URLSearchParams({
      response_type: 'code',
      client_id: this.clientId,
      redirect_uri: this.redirectUri,
      scope: 'openid email profile',
      state,
    });
    return `https://${this.domain}/oauth2/authorize?${params.toString()}`;
  }

  buildLogoutUrl(logoutUri: string): string {
    const params = new URLSearchParams({
      client_id: this.clientId,
      logout_uri: logoutUri,
    });
    return `https://${this.domain}/logout?${params.toString()}`;
  }

  async exchangeCodeForTokens(code: string): Promise<CognitoTokenSet> {
    const url = `https://${this.domain}/oauth2/token`;
    const body = new URLSearchParams({
      grant_type: 'authorization_code',
      client_id: this.clientId,
      code,
      redirect_uri: this.redirectUri,
    });
    const basic = Buffer.from(`${this.clientId}:${this.clientSecret}`).toString(
      'base64',
    );

    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        Authorization: `Basic ${basic}`,
      },
      body: body.toString(),
    });

    if (!res.ok) {
      const text = await res.text();
      throw new UnauthorizedException(
        `Cognito token endpoint error (${res.status}): ${text}`,
      );
    }
    return (await res.json()) as CognitoTokenSet;
  }

  decodeIdToken(idToken: string): CognitoIdTokenPayload {
    const parts = idToken.split('.');
    if (parts.length !== 3) {
      throw new BadRequestException('Malformed id_token');
    }
    const json = Buffer.from(parts[1], 'base64url').toString('utf8');
    return JSON.parse(json) as CognitoIdTokenPayload;
  }

  async refreshTokens(
    refreshToken: string,
    username: string,
  ): Promise<CognitoTokenSet> {
    try {
      const result = await this.cognito.send(
        new InitiateAuthCommand({
          AuthFlow: AuthFlowType.REFRESH_TOKEN_AUTH,
          ClientId: this.clientId,
          AuthParameters: {
            REFRESH_TOKEN: refreshToken,
            SECRET_HASH: this.computeSecretHash(username),
          },
        }),
      );
      const r = result.AuthenticationResult;
      if (!r?.AccessToken || !r?.IdToken) {
        throw new UnauthorizedException(
          'Cognito returned no tokens on refresh',
        );
      }
      return {
        access_token: r.AccessToken,
        id_token: r.IdToken,
        refresh_token: r.RefreshToken ?? refreshToken,
        expires_in: r.ExpiresIn ?? 3600,
        token_type: r.TokenType ?? 'Bearer',
      };
    } catch (err) {
      if (err instanceof NotAuthorizedException) {
        throw new UnauthorizedException(err.message);
      }
      throw err;
    }
  }

  private computeSecretHash(username: string): string {
    return createHmac('sha256', this.clientSecret)
      .update(username + this.clientId)
      .digest('base64');
  }
}
