import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { AppModule } from '../../src/app.module';
import { AuthService } from '../../src/auth/auth.service';

/** Levanta la app Nest real (con iron-session middleware) para e2e. */
export async function createE2EApp(): Promise<INestApplication> {
  const moduleRef = await Test.createTestingModule({
    imports: [AppModule],
  }).compile();

  const app = moduleRef.createNestApplication();
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );
  await app.init();
  return app;
}

/**
 * Simula el flujo OIDC (login → callback) sin Cognito real: espía
 * `exchangeCodeForTokens` y `decodeIdToken` para mintear una sesión con los
 * grupos dados y `loginOrigin = origin`. Devuelve un agente supertest con la
 * cookie de sesión ya establecida.
 */
export async function loginAs(
  app: INestApplication,
  origin: 'A' | 'B',
  groups: string[],
) {
  const authService = app.get(AuthService);
  const now = Math.floor(Date.now() / 1000);

  jest.spyOn(authService, 'exchangeCodeForTokens').mockResolvedValue({
    id_token: 'fake.id.token',
    access_token: 'fake-access',
    refresh_token: 'fake-refresh',
    expires_in: 3600,
    token_type: 'Bearer',
  });
  jest.spyOn(authService, 'decodeIdToken').mockReturnValue({
    sub: 'user-sub-1',
    email: 'tester@example.com',
    'cognito:username': 'tester',
    'cognito:groups': groups,
    exp: now + 3600,
    iat: now,
    aud: 'test-client-id',
  });

  const agent = request.agent(app.getHttpServer());
  const loginRes = await agent.get(`/auth/login?origin=${origin}`);
  const state = new URL(
    loginRes.headers.location as string,
  ).searchParams.get('state');
  await agent.get(`/auth/callback?code=fake-code&state=${state}`);

  return agent;
}
