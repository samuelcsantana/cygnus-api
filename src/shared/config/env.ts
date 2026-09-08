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
  // Optional so local dev/CI/test environments without a Resend account still pass env validation
  // — EmailService no-ops (logs a warning) instead of throwing when these are unset.
  RESEND_API_KEY: z.string().optional(),
  RESEND_FROM_EMAIL: z.string().optional(),
  GOOGLE_CLIENT_ID: z.string().optional(),
  GOOGLE_CLIENT_SECRET: z.string().optional(),
  GOOGLE_REDIRECT_URI: z.union([z.string().url(), z.literal('')]).optional(),
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

  const googleValues = [parsed.data.GOOGLE_CLIENT_ID, parsed.data.GOOGLE_CLIENT_SECRET, parsed.data.GOOGLE_REDIRECT_URI];
  if (googleValues.some(Boolean) && !googleValues.every(Boolean)) {
    throw new Error('Google sign-in requires GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET and GOOGLE_REDIRECT_URI together');
  }
  if (parsed.data.GOOGLE_REDIRECT_URI) {
    const callback = new URL(parsed.data.GOOGLE_REDIRECT_URI);
    if (callback.protocol !== 'https:' && !(callback.protocol === 'http:' && callback.hostname === 'localhost')) {
      throw new Error('GOOGLE_REDIRECT_URI requires HTTPS except on localhost');
    }
  }

  return { ...parsed.data, secureCookies };
}

export const env = loadEnv();
export type Env = typeof env;
