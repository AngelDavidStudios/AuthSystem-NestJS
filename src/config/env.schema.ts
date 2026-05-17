import { z } from 'zod';

export const EnvSchema = z.object({
  // AWS General
  AWS_REGION: z.string().min(1),
  AWS_ACCESS_KEY_ID: z.string().min(1),
  AWS_SECRET_ACCESS_KEY: z.string().min(1),

  // Cognito — single confidential App Client for the BFF
  COGNITO_REGION: z.string().min(1),
  COGNITO_USER_POOL_ID: z
    .string()
    .regex(
      /^[a-z0-9-]+_[A-Za-z0-9]+$/,
      'COGNITO_USER_POOL_ID must follow the "<region>_<id>" format',
    ),
  COGNITO_CLIENT_ID: z.string().min(1),
  COGNITO_CLIENT_SECRET: z.string().min(1),
  COGNITO_DOMAIN: z.string().min(1),
  COGNITO_JWKS_URL: z.url(),
  COGNITO_REDIRECT_URI: z.url(),
  COGNITO_LOGOUT_URI: z.url(),

  // KMS
  KMS_KEY_ID: z.string().min(1),

  // BFF session (iron-session)
  SESSION_SECRET: z
    .string()
    .min(32, 'SESSION_SECRET must be at least 32 characters for AES-256-GCM'),
  SESSION_COOKIE_NAME: z.string().min(1).default('sistema_c_session'),

  // Allowed SPA origins (CORS + post-login redirect targets)
  FRONTEND_URL_A: z.url(),
  FRONTEND_URL_B: z.url(),

  // App
  PORT: z.coerce.number().int().positive().default(3000),
  NODE_ENV: z
    .enum(['development', 'production', 'test'])
    .default('development'),
});

export type Env = z.infer<typeof EnvSchema>;
