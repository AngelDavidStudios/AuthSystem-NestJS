import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { passportJwtSecret } from 'jwks-rsa';
import type { Env } from '../../config/env.schema';

export interface CognitoJwtPayload {
  sub: string;
  email?: string;
  'cognito:groups'?: string[];
  'cognito:username'?: string;
  token_use?: 'id' | 'access';
  aud?: string;
  client_id?: string;
}

export interface AuthenticatedUser {
  sub: string;
  email?: string;
  groups: string[];
  username?: string;
  tokenUse?: 'id' | 'access';
  aud?: string;
}

@Injectable()
export class CognitoJwtStrategy extends PassportStrategy(Strategy, 'jwt') {
  constructor(config: ConfigService<Env, true>) {
    const region = config.get('COGNITO_REGION', { infer: true });
    const userPoolId = config.get('COGNITO_USER_POOL_ID', { infer: true });
    const jwksUri = config.get('COGNITO_JWKS_URL', { infer: true });
    const clientIdA = config.get('COGNITO_CLIENT_ID_A', { infer: true });
    const clientIdB = config.get('COGNITO_CLIENT_ID_B', { infer: true });
    const audiences = [clientIdA, clientIdB].filter((v) => v.length > 0);

    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKeyProvider: passportJwtSecret({
        jwksUri,
        cache: true,
        rateLimit: true,
      }),
      issuer: `https://cognito-idp.${region}.amazonaws.com/${userPoolId}`,
      algorithms: ['RS256'],
      audience: audiences.length > 0 ? audiences : undefined,
    });
  }

  validate(payload: CognitoJwtPayload): AuthenticatedUser {
    return {
      sub: payload.sub,
      email: payload.email,
      groups: payload['cognito:groups'] ?? [],
      username: payload['cognito:username'],
      tokenUse: payload.token_use,
      aud: payload.aud ?? payload.client_id,
    };
  }
}
