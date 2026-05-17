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
import { createHmac } from 'crypto';

export interface RefreshedTokens {
  accessToken?: string;
  idToken?: string;
  expiresIn?: number;
  tokenType?: string;
}

@Injectable()
export class AuthService {
  private readonly cognito: CognitoIdentityProviderClient;
  private readonly clientIdA: string | undefined;
  private readonly clientSecretA: string | undefined;
  private readonly clientIdB: string | undefined;

  constructor(private readonly config: ConfigService) {
    this.cognito = new CognitoIdentityProviderClient({
      region: this.config.getOrThrow<string>('COGNITO_REGION'),
    });
    this.clientIdA = this.config.get<string>('COGNITO_CLIENT_ID_A');
    this.clientSecretA = this.config.get<string>('COGNITO_CLIENT_SECRET_A');
    this.clientIdB = this.config.get<string>('COGNITO_CLIENT_ID_B');
  }

  async refreshTokens(
    refreshToken: string,
    clientId: string,
    username?: string,
  ): Promise<RefreshedTokens> {
    const secret = this.resolveClientSecret(clientId);

    const authParameters: Record<string, string> = {
      REFRESH_TOKEN: refreshToken,
    };

    if (secret) {
      if (!username) {
        throw new BadRequestException(
          'username is required when refreshing tokens for a confidential client',
        );
      }
      authParameters.SECRET_HASH = this.computeSecretHash(
        username,
        clientId,
        secret,
      );
    }

    try {
      const result = await this.cognito.send(
        new InitiateAuthCommand({
          AuthFlow: AuthFlowType.REFRESH_TOKEN_AUTH,
          ClientId: clientId,
          AuthParameters: authParameters,
        }),
      );

      const r = result.AuthenticationResult;
      return {
        accessToken: r?.AccessToken,
        idToken: r?.IdToken,
        expiresIn: r?.ExpiresIn,
        tokenType: r?.TokenType,
      };
    } catch (err) {
      if (err instanceof NotAuthorizedException) {
        throw new UnauthorizedException(err.message);
      }
      throw err;
    }
  }

  private resolveClientSecret(clientId: string): string | undefined {
    if (clientId === this.clientIdA) return this.clientSecretA;
    if (clientId === this.clientIdB) return undefined;
    throw new BadRequestException(`Unknown clientId: ${clientId}`);
  }

  private computeSecretHash(
    username: string,
    clientId: string,
    clientSecret: string,
  ): string {
    return createHmac('sha256', clientSecret)
      .update(username + clientId)
      .digest('base64');
  }
}
