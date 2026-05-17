import { z } from 'zod';

export const EnvSchema = z.object({
  // AWS General
  AWS_REGION: z.string().min(1),
  AWS_ACCESS_KEY_ID: z.string().min(1),
  AWS_SECRET_ACCESS_KEY: z.string().min(1),

  // Cognito
  COGNITO_REGION: z.string().min(1),
  COGNITO_USER_POOL_ID: z
    .string()
    .regex(
      /^[a-z0-9-]+_[A-Za-z0-9]+$/,
      'COGNITO_USER_POOL_ID must follow the "<region>_<id>" format',
    ),
  COGNITO_CLIENT_ID_A: z.string().min(1),
  COGNITO_CLIENT_SECRET_A: z.string().min(1),
  COGNITO_CLIENT_ID_B: z.string().min(1),
  COGNITO_DOMAIN: z.string().min(1),
  COGNITO_JWKS_URL: z.url(),

  // KMS
  KMS_KEY_ID: z.string().min(1),

  // App
  PORT: z.coerce.number().int().positive().default(3000),
  NODE_ENV: z
    .enum(['development', 'production', 'test'])
    .default('development'),
});

export type Env = z.infer<typeof EnvSchema>;
