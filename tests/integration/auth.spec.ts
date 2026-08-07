import { FastifyInstance } from 'fastify';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { buildApp } from '../../src/infrastructure/http/build-app';
import { prisma } from '../../src/infrastructure/database/prisma-client';

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

  it('exposes all auth routes in the generated OpenAPI document', async () => {
    const response = await app.inject({ method: 'GET', url: '/docs/json' });
    const openApiDocument = response.json();

    for (const path of ['/auth/register', '/auth/login', '/auth/logout', '/auth/refresh']) {
      expect(openApiDocument.paths[path]).toBeDefined();
      expect(openApiDocument.paths[path].post.tags).toContain('Auth');
    }

    expect(openApiDocument.paths['/auth/me']).toBeDefined();
    expect(openApiDocument.paths['/auth/me'].get.tags).toContain('Auth');
  });
});
