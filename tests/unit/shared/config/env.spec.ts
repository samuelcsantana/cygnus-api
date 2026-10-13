import { afterEach, describe, expect, it, vi } from 'vitest';

/**
 * env.ts validates process.env once, at import, and a mistake there should stop the server at boot
 * with a message that names the variable - not surface later as a cookie the browser drops or a
 * Google callback that never returns. Each test imports a fresh copy of the module.
 *
 * `dotenv/config` is stubbed: it would fill any variable a test removes from the developer's own
 * .env file, and the result would depend on the machine the suite runs on.
 */
vi.mock('dotenv/config', () => ({}));

describe('env', () => {
  const original = { ...process.env };

  afterEach(() => {
    for (const key of Object.keys(process.env)) {
      if (!(key in original)) delete process.env[key];
    }
    Object.assign(process.env, original);
    vi.resetModules();
  });

  async function loadEnvWith(overrides: Record<string, string | undefined>) {
    vi.resetModules();
    const values = { GOOGLE_CLIENT_ID: undefined, GOOGLE_CLIENT_SECRET: undefined, GOOGLE_REDIRECT_URI: undefined, ...overrides };
    for (const [key, value] of Object.entries(values)) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
    return (await import('../../../../src/shared/config/env')).env;
  }

  it('refuses to start with a JWT secret shorter than 32 characters, naming the variable', async () => {
    await expect(loadEnvWith({ JWT_ACCESS_SECRET: 'too-short' })).rejects.toThrow(/Invalid environment variables:\nJWT_ACCESS_SECRET/);
  });

  it('marks cookies Secure in production by default', async () => {
    const env = await loadEnvWith({ NODE_ENV: 'production', SECURE_COOKIES: undefined });

    expect(env.secureCookies).toBe(true);
  });

  // The compose stack runs the production image over plain HTTP; with Secure cookies the browser
  // would drop them and every request after the login would answer 401.
  it('lets SECURE_COOKIES=false override production, as the local compose stack needs', async () => {
    const env = await loadEnvWith({ NODE_ENV: 'production', SECURE_COOKIES: 'false' });

    expect(env.secureCookies).toBe(false);
  });

  it('refuses a partial Google configuration', async () => {
    await expect(loadEnvWith({ GOOGLE_CLIENT_ID: 'client-id' })).rejects.toThrow(
      'Google sign-in requires GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET and GOOGLE_REDIRECT_URI together',
    );
  });

  it('refuses a Google callback over plain HTTP anywhere but localhost', async () => {
    const google = { GOOGLE_CLIENT_ID: 'client-id', GOOGLE_CLIENT_SECRET: 'client-secret' };

    await expect(loadEnvWith({ ...google, GOOGLE_REDIRECT_URI: 'http://cygnus.example.com/auth/google/callback' })).rejects.toThrow(
      'GOOGLE_REDIRECT_URI requires HTTPS except on localhost',
    );
    await expect(loadEnvWith({ ...google, GOOGLE_REDIRECT_URI: 'http://localhost:3005/auth/google/callback' })).resolves.toMatchObject({
      GOOGLE_CLIENT_ID: 'client-id',
    });
  });

  it('keeps the production rate limits when none is configured', async () => {
    const env = await loadEnvWith({
      NODE_ENV: 'production',
      RATE_LIMIT_PER_MINUTE: undefined,
      AUTH_RATE_LIMIT_PER_MINUTE: undefined,
      DEMO_RATE_LIMIT_PER_HOUR: undefined,
    });

    expect(env.rateLimits).toEqual({ perMinute: 100, authPerMinute: 10, demoPerHour: 10, relaxed: false });
  });

  it('takes the limits the compose stack sets, and says they were overridden', async () => {
    const env = await loadEnvWith({
      NODE_ENV: 'production',
      RATE_LIMIT_PER_MINUTE: '1000',
      AUTH_RATE_LIMIT_PER_MINUTE: '1000',
      DEMO_RATE_LIMIT_PER_HOUR: '1000',
    });

    expect(env.rateLimits).toEqual({ perMinute: 1000, authPerMinute: 1000, demoPerHour: 1000, relaxed: true });
  });

  it.each(['0', '-5', 'many'])('refuses a rate limit of %j, naming the variable', async (value) => {
    await expect(loadEnvWith({ AUTH_RATE_LIMIT_PER_MINUTE: value })).rejects.toThrow(/AUTH_RATE_LIMIT_PER_MINUTE/);
  });
});
