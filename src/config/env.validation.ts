import { z } from 'zod';
import { EnvSchema, type Env } from './env.schema';

export function validateEnv(config: Record<string, unknown>): Env {
  const result = EnvSchema.safeParse(config);

  if (!result.success) {
    const issues = z.prettifyError(result.error);
    throw new Error(
      `Invalid environment variables — fix the following before starting:\n${issues}`,
    );
  }

  return result.data;
}
