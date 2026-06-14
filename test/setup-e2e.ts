/**
 * Variables de entorno deterministas para los tests e2e. Se ejecuta vía
 * `setupFiles` ANTES de importar AppModule, de modo que la validación Zod de
 * ConfigModule pase sin depender de un `.env` (no existe en CI). No se pega a
 * AWS real: Cognito (exchangeCodeForTokens/decodeIdToken) se espía y KMS se
 * mockea con aws-sdk-client-mock.
 */
process.env.NODE_ENV = 'test';
process.env.AWS_REGION = 'us-east-1';
process.env.AWS_ACCESS_KEY_ID = 'test';
process.env.AWS_SECRET_ACCESS_KEY = 'test';

process.env.COGNITO_REGION = 'us-east-1';
process.env.COGNITO_USER_POOL_ID = 'us-east-1_Test123';
process.env.COGNITO_CLIENT_ID = 'test-client-id';
process.env.COGNITO_CLIENT_SECRET = 'test-client-secret';
process.env.COGNITO_DOMAIN = 'test.auth.us-east-1.amazoncognito.com';
process.env.COGNITO_JWKS_URL =
  'https://cognito-idp.us-east-1.amazonaws.com/us-east-1_Test123/.well-known/jwks.json';
process.env.COGNITO_REDIRECT_URI = 'http://localhost:3000/auth/callback';

process.env.KMS_KEY_ID = 'test-key-id';
process.env.SESSION_SECRET =
  'test-session-secret-with-at-least-32-characters-long';
process.env.SESSION_COOKIE_NAME = 'sistema_c_session';
process.env.FRONTEND_URL_A = 'http://localhost:5173';
process.env.FRONTEND_URL_B = 'http://localhost:5174';
process.env.PORT = '3000';
