import { randomUUID } from 'node:crypto';
import { FastifyInstance } from 'fastify';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { buildApp } from '../../src/infrastructure/http/build-app';
import { prisma } from '../../src/infrastructure/database/prisma-client';
import { verificationCodeService } from '../../src/infrastructure/security/verification-code-service.instance';

describe('Auth routes', () => {
  let app: FastifyInstance;

  beforeAll(async () => {
    app = await buildApp();
    await app.ready();
  });

  afterAll(async () => {
    await app.close();
    await prisma.$disconnect();
  });

  beforeEach(async () => {
    await prisma.user.deleteMany();
  });

  function extractCookieNames(setCookieHeader: string | string[] | undefined): string[] {
    const values = Array.isArray(setCookieHeader) ? setCookieHeader : setCookieHeader ? [setCookieHeader] : [];
    return values.map((cookie) => cookie.split('=')[0]);
  }

  function extractCookieHeader(setCookieHeader: string | string[] | undefined): string {
    const values = Array.isArray(setCookieHeader) ? setCookieHeader : setCookieHeader ? [setCookieHeader] : [];
    return values.map((cookie) => cookie.split(';')[0]).join('; ');
  }

  async function registerAndLogin(email: string): Promise<string> {
    await app.inject({
      method: 'POST',
      url: '/auth/register',
      payload: { email, password: 'S3cur3-Password', name: 'Jane Doe' },
    });

    const loginResponse = await app.inject({
      method: 'POST',
      url: '/auth/login',
      payload: { email, password: 'S3cur3-Password' },
    });

    return extractCookieHeader(loginResponse.headers['set-cookie']);
  }

  describe('POST /auth/register', () => {
    it('creates a new user and never returns the password hash', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/auth/register',
        payload: { email: 'parent@example.com', password: 'S3cur3-Password', name: 'Jane Doe' },
      });

      expect(response.statusCode).toBe(201);

      const body = response.json();
      expect(body).toMatchObject({ email: 'parent@example.com', name: 'Jane Doe' });
      expect(body.passwordHash).toBeUndefined();
      expect(body.id).toBeDefined();
    });

    it('rejects duplicate emails with 409', async () => {
      await app.inject({
        method: 'POST',
        url: '/auth/register',
        payload: { email: 'duplicate@example.com', password: 'S3cur3-Password', name: 'Jane Doe' },
      });

      const response = await app.inject({
        method: 'POST',
        url: '/auth/register',
        payload: { email: 'duplicate@example.com', password: 'Another-Password1', name: 'John Doe' },
      });

      expect(response.statusCode).toBe(409);
      expect(response.json().status).toBe('error');
    });

    it('rejects an invalid payload with 400', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/auth/register',
        payload: { email: 'not-an-email', password: 'short', name: '' },
      });

      expect(response.statusCode).toBe(400);
    });
  });

  describe('POST /auth/login', () => {
    it('authenticates a valid user and sets HTTP-only cookies without leaking tokens in the body', async () => {
      await app.inject({
        method: 'POST',
        url: '/auth/register',
        payload: { email: 'login@example.com', password: 'S3cur3-Password', name: 'Jane Doe' },
      });

      const response = await app.inject({
        method: 'POST',
        url: '/auth/login',
        payload: { email: 'login@example.com', password: 'S3cur3-Password' },
      });

      expect(response.statusCode).toBe(200);

      const body = response.json();
      expect(body).toEqual({ status: 'ok', message: 'Authenticated successfully' });
      expect(JSON.stringify(body)).not.toMatch(/eyJ/); // no raw JWT leaked in the JSON body

      const cookieNames = extractCookieNames(response.headers['set-cookie']);
      expect(cookieNames).toEqual(expect.arrayContaining(['access_token', 'refresh_token', 'csrf_token']));

      const setCookieHeader = Array.isArray(response.headers['set-cookie'])
        ? response.headers['set-cookie']
        : [response.headers['set-cookie'] as string];

      for (const cookie of setCookieHeader) {
        expect(cookie).toMatch(/SameSite=Strict/i);

        // The CSRF cookie must be readable by frontend JS (double-submit pattern) — every other
        // session cookie must stay HttpOnly.
        if (cookie.startsWith('csrf_token=')) {
          expect(cookie).not.toMatch(/HttpOnly/i);
        } else {
          expect(cookie).toMatch(/HttpOnly/i);
        }
      }
    });

    it('rejects invalid credentials with 401', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/auth/login',
        payload: { email: 'unknown@example.com', password: 'whatever' },
      });

      expect(response.statusCode).toBe(401);
      expect(response.json().status).toBe('error');
    });
  });

  describe('POST /auth/logout', () => {
    it('clears the auth cookies', async () => {
      const response = await app.inject({ method: 'POST', url: '/auth/logout' });

      expect(response.statusCode).toBe(200);
      expect(response.json()).toEqual({ status: 'ok', message: 'Logged out successfully' });

      const setCookieHeader = response.headers['set-cookie'];
      const cookies = Array.isArray(setCookieHeader) ? setCookieHeader : [setCookieHeader as string];
      expect(cookies.some((cookie) => cookie.includes('access_token=;'))).toBe(true);
      expect(cookies.some((cookie) => cookie.includes('refresh_token=;'))).toBe(true);
      expect(cookies.some((cookie) => cookie.includes('csrf_token=;'))).toBe(true);
    });

    it('revokes the refresh token so it can no longer be used to refresh the session', async () => {
      const cookie = await registerAndLogin('logout-revoke@example.com');

      const logoutResponse = await app.inject({ method: 'POST', url: '/auth/logout', headers: { cookie } });
      expect(logoutResponse.statusCode).toBe(200);

      const refreshResponse = await app.inject({ method: 'POST', url: '/auth/refresh', headers: { cookie } });

      expect(refreshResponse.statusCode).toBe(401);
      expect(refreshResponse.json().status).toBe('error');
    });
  });

  describe('POST /auth/refresh', () => {
    it('rotates the session and sets new HTTP-only cookies from a valid refresh token', async () => {
      const cookie = await registerAndLogin('refresh@example.com');

      const response = await app.inject({
        method: 'POST',
        url: '/auth/refresh',
        headers: { cookie },
      });

      expect(response.statusCode).toBe(200);
      expect(response.json()).toEqual({ status: 'ok', message: 'Session refreshed successfully' });

      const cookieNames = extractCookieNames(response.headers['set-cookie']);
      expect(cookieNames).toEqual(expect.arrayContaining(['access_token', 'refresh_token']));
    });

    it('rejects a request without a refresh_token cookie with 401', async () => {
      const response = await app.inject({ method: 'POST', url: '/auth/refresh' });

      expect(response.statusCode).toBe(401);
      expect(response.json().status).toBe('error');
    });

    it('rejects a garbage refresh_token cookie with 401', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/auth/refresh',
        headers: { cookie: 'refresh_token=not-a-real-token' },
      });

      expect(response.statusCode).toBe(401);
      expect(response.json().status).toBe('error');
    });

    it('rejects reuse of a refresh token that was already rotated (single-use enforcement)', async () => {
      const cookie = await registerAndLogin('refresh-reuse@example.com');

      const firstRefresh = await app.inject({ method: 'POST', url: '/auth/refresh', headers: { cookie } });
      expect(firstRefresh.statusCode).toBe(200);

      // Replay the original (now-rotated-away) refresh_token cookie.
      const secondRefresh = await app.inject({ method: 'POST', url: '/auth/refresh', headers: { cookie } });

      expect(secondRefresh.statusCode).toBe(401);
      expect(secondRefresh.json().status).toBe('error');
    });
  });

  describe('GET /auth/me', () => {
    it("returns the authenticated user's profile", async () => {
      const cookie = await registerAndLogin('me@example.com');

      const response = await app.inject({ method: 'GET', url: '/auth/me', headers: { cookie } });

      expect(response.statusCode).toBe(200);
      expect(response.json()).toMatchObject({ email: 'me@example.com', name: 'Jane Doe' });
      expect(response.json().passwordHash).toBeUndefined();
    });

    it('rejects a request without an access_token cookie with 401', async () => {
      const response = await app.inject({ method: 'GET', url: '/auth/me' });

      expect(response.statusCode).toBe(401);
      expect(response.json().status).toBe('error');
    });
  });

  // The assisted flows: a 6-digit code mailed to an address, exchanged for a session. Codes are
  // planted through the real service rather than read out of an e-mail, because EmailService
  // no-ops without RESEND_API_KEY — which is exactly how the test environment runs.
  describe('assisted sign-in and password reset', () => {
    async function register(email: string): Promise<void> {
      await app.inject({
        method: 'POST',
        url: '/auth/register',
        payload: { email, password: 'S3cur3-Password', name: 'Jane Doe' },
      });
    }

    // Requesting a code is throttled per address over a 15-minute window that outlives the suite,
    // so a fixed address would start coming back throttled on the fifth run in a quarter of an
    // hour — green in CI, flaky for whoever is iterating locally.
    function uniqueEmail(prefix: string): string {
      return `${prefix}-${randomUUID()}@example.com`;
    }

    async function issueCode(purpose: 'passwordless' | 'password-reset', email: string): Promise<string> {
      const code = await verificationCodeService.issue(purpose, email);

      if (!code) {
        throw new Error(`Verification code request was throttled for ${email}`);
      }

      return code;
    }

    it('answers a code request identically for a registered and an unknown address', async () => {
      const email = uniqueEmail('registered');
      await register(email);

      const registeredResponse = await app.inject({
        method: 'POST',
        url: '/auth/passwordless/request',
        payload: { email },
      });
      const unknownResponse = await app.inject({
        method: 'POST',
        url: '/auth/passwordless/request',
        payload: { email: 'nobody@example.com' },
      });

      expect(registeredResponse.statusCode).toBe(200);
      expect(unknownResponse.statusCode).toBe(200);
      expect(unknownResponse.json()).toEqual(registeredResponse.json());
    });

    it('answers a code request in the same time for a registered and an unknown address', async () => {
      // The other half of the guarantee the test above covers. An identical body proves nothing
      // if the clock answers the question instead: a registered address wrote a code to Redis and
      // awaited a mail that an unknown address never triggered, and that measured 161ms against
      // 4ms from outside.
      //
      // What this can and cannot catch is worth being explicit about. RESEND_API_KEY is unset in
      // the test environment, so EmailService no-ops and the ~156ms the mail contributed is not
      // reproducible here at all — the difference this would measure without the floor is under a
      // millisecond. The assertion that carries the weight is therefore the floor itself: both
      // paths must take at least as long as it, which is false the moment the floor is removed.
      const samples = 5;
      const registered: number[] = [];
      const unknown: number[] = [];

      for (let index = 0; index < samples; index++) {
        const email = uniqueEmail(`timing-${index}`);
        await register(email);

        // Interleaved on purpose: measuring one case to exhaustion and then the other turns any
        // drift on the machine running the suite into a difference between the cases.
        let startedAt = performance.now();
        await app.inject({ method: 'POST', url: '/auth/passwordless/request', payload: { email } });
        registered.push(performance.now() - startedAt);

        startedAt = performance.now();
        await app.inject({
          method: 'POST',
          url: '/auth/passwordless/request',
          payload: { email: `nobody-${index}@example.com` },
        });
        unknown.push(performance.now() - startedAt);
      }

      const median = (values: number[]) => [...values].sort((a, b) => a - b)[Math.floor(values.length / 2)]!;
      const registeredMedian = median(registered);
      const unknownMedian = median(unknown);

      // 100 rather than the 120 the floor is set to: the assertion is that a floor is being
      // applied at all, and leaving margin keeps a slow scheduler from failing the suite.
      expect(unknownMedian).toBeGreaterThanOrEqual(100);
      expect(registeredMedian).toBeGreaterThanOrEqual(100);

      // And the two must be indistinguishable from one another.
      expect(Math.abs(registeredMedian - unknownMedian)).toBeLessThan(50);
    });

    it('exchanges a valid code for the same session cookies a password login sets', async () => {
      const email = uniqueEmail('passwordless');
      await register(email);
      const code = await issueCode('passwordless', email);

      const response = await app.inject({
        method: 'POST',
        url: '/auth/passwordless/verify',
        payload: { email, code },
      });

      expect(response.statusCode).toBe(200);
      expect(extractCookieNames(response.headers['set-cookie'])).toEqual(
        expect.arrayContaining(['access_token', 'refresh_token', 'csrf_token']),
      );

      const meResponse = await app.inject({
        method: 'GET',
        url: '/auth/me',
        headers: { cookie: extractCookieHeader(response.headers['set-cookie']) },
      });
      expect(meResponse.statusCode).toBe(200);
      expect(meResponse.json().email).toBe(email);
    });

    it('rejects a wrong code with 401, and burns the real code after it is used once', async () => {
      const email = uniqueEmail('single-use');
      await register(email);
      const code = await issueCode('passwordless', email);

      const wrongCodeResponse = await app.inject({
        method: 'POST',
        url: '/auth/passwordless/verify',
        payload: { email, code: '000000' },
      });
      expect(wrongCodeResponse.statusCode).toBe(401);

      const firstUse = await app.inject({
        method: 'POST',
        url: '/auth/passwordless/verify',
        payload: { email, code },
      });
      const replay = await app.inject({
        method: 'POST',
        url: '/auth/passwordless/verify',
        payload: { email, code },
      });

      expect(firstUse.statusCode).toBe(200);
      expect(replay.statusCode).toBe(401);
    });

    it('refuses a sign-in code on the reset endpoint, and answers 401 for an address with no account', async () => {
      const email = uniqueEmail('scoped');
      await register(email);
      const passwordlessCode = await issueCode('passwordless', email);

      const crossPurposeResponse = await app.inject({
        method: 'POST',
        url: '/auth/password-reset/verify',
        payload: { email, code: passwordlessCode, password: 'Another-Password' },
      });
      const unknownAddressResponse = await app.inject({
        method: 'POST',
        url: '/auth/passwordless/verify',
        payload: { email: 'nobody@example.com', code: '123456' },
      });

      expect(crossPurposeResponse.statusCode).toBe(401);
      expect(unknownAddressResponse.statusCode).toBe(401);
      expect(unknownAddressResponse.json().message).toBe(crossPurposeResponse.json().message);
    });

    it('resets the password, signs the user in, and kills the sessions that predate the reset', async () => {
      const email = uniqueEmail('reset');
      const oldSessionCookies = await registerAndLogin(email);

      const code = await issueCode('password-reset', email);
      const resetResponse = await app.inject({
        method: 'POST',
        url: '/auth/password-reset/verify',
        payload: { email, code, password: 'A-Brand-New-Password' },
      });

      expect(resetResponse.statusCode).toBe(200);

      // The device that was already logged in cannot rotate its session any more...
      const oldSessionRefresh = await app.inject({
        method: 'POST',
        url: '/auth/refresh',
        headers: { cookie: oldSessionCookies },
      });
      expect(oldSessionRefresh.statusCode).toBe(401);

      // ...while the session the reset just handed back does.
      const newSessionRefresh = await app.inject({
        method: 'POST',
        url: '/auth/refresh',
        headers: { cookie: extractCookieHeader(resetResponse.headers['set-cookie']) },
      });
      expect(newSessionRefresh.statusCode).toBe(200);

      const oldPasswordLogin = await app.inject({
        method: 'POST',
        url: '/auth/login',
        payload: { email, password: 'S3cur3-Password' },
      });
      const newPasswordLogin = await app.inject({
        method: 'POST',
        url: '/auth/login',
        payload: { email, password: 'A-Brand-New-Password' },
      });

      expect(oldPasswordLogin.statusCode).toBe(401);
      expect(newPasswordLogin.statusCode).toBe(200);
    });
  });

  it('exposes all auth routes in the generated OpenAPI document', async () => {
    const response = await app.inject({ method: 'GET', url: '/docs/json' });
    const openApiDocument = response.json();

    for (const path of [
      '/auth/register',
      '/auth/login',
      '/auth/logout',
      '/auth/refresh',
      '/auth/passwordless/request',
      '/auth/passwordless/verify',
      '/auth/password-reset/request',
      '/auth/password-reset/verify',
    ]) {
      expect(openApiDocument.paths[path]).toBeDefined();
      expect(openApiDocument.paths[path].post.tags).toContain('Auth');
    }

    expect(openApiDocument.paths['/auth/me']).toBeDefined();
    expect(openApiDocument.paths['/auth/me'].get.tags).toContain('Auth');
  });
});
