import 'dotenv/config';
import { z } from 'zod';

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().positive().default(3000),
  HOST: z.string().default('0.0.0.0'),
  CORS_ORIGIN: z.string().min(1),
  DATABASE_URL: z.string().url(),
  REDIS_URL: z.string().min(1),
  JWT_ACCESS_SECRET: z.string().min(32),
  JWT_REFRESH_SECRET: z.string().min(32),
  JWT_ACCESS_EXPIRES_IN: z.string().default('15m'),
  JWT_REFRESH_EXPIRES_IN: z.string().default('7d'),
  // Whether to mark auth cookies `Secure` (requires HTTPS to be stored by the browser at all).
  // Defaults to NODE_ENV === 'production', but is settable independently: the production Docker
  // image is also used to run this API locally over plain HTTP, where NODE_ENV stays 'production'
  // (matching the real deployment build) but the browser would silently drop a Secure cookie.
  SECURE_COOKIES: z.enum(['true', 'false']).optional(),
});

function loadEnv() {
  const parsed = envSchema.safeParse(process.env);

  if (!parsed.success) {
    const issues = parsed.error.issues.map((issue) => `${issue.path.join('.')}: ${issue.message}`).join('\n');
    throw new Error(`Invalid environment variables:\n${issues}`);
  }

  const secureCookies = parsed.data.SECURE_COOKIES
    ? parsed.data.SECURE_COOKIES === 'true'
    : parsed.data.NODE_ENV === 'production';

  return { ...parsed.data, secureCookies };
}

export const env = loadEnv();
export type Env = typeof env;
