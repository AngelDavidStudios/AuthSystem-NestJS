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

  // KMS
  KMS_KEY_ID: z.string().min(1),

  // DynamoDB — tablas del módulo de vacaciones (creadas manualmente en AWS).
  // En Lambda la región sale del runtime; en local de AWS_REGION del .env.
  DDB_TABLE_VACATION_REQUESTS: z
    .string()
    .min(1)
    .default('wfn-vacation-requests'),
  DDB_TABLE_VACATION_BALANCES: z
    .string()
    .min(1)
    .default('wfn-vacation-balances'),
  DDB_TABLE_ORG_NODES: z.string().min(1).default('wfn-org-nodes'),
  DDB_TABLE_AUDIT_LOGS: z.string().min(1).default('wfn-audit-logs'),

  // BFF session (iron-session)
  SESSION_SECRET: z
    .string()
    .min(32, 'SESSION_SECRET must be at least 32 characters for AES-256-GCM'),
  SESSION_COOKIE_NAME: z.string().min(1).default('sistema_c_session'),

  // Allowed SPA origins (CORS + post-login redirect targets)
  FRONTEND_URL_A: z.url(),
  FRONTEND_URL_B: z.url(),
  // Orígenes adicionales permitidos (CORS + validación de return_to/logout),
  // separados por comas. FRONTEND_URL_A/B siempre se incluyen además de estos.
  // Ej: "http://localhost:5173,http://localhost:5174,https://a.netlify.app"
  ALLOWED_ORIGINS: z.string().default(''),

  // App
  PORT: z.coerce.number().int().positive().default(3000),
  NODE_ENV: z
    .enum(['development', 'production', 'test'])
    .default('development'),
});

export type Env = z.infer<typeof EnvSchema>;
