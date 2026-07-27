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
      expect(cookieNames).toEqual(expect.arrayContaining(['access_token', 'refresh_token']));

      const setCookieHeader = Array.isArray(response.headers['set-cookie'])
        ? response.headers['set-cookie']
        : [response.headers['set-cookie'] as string];

      for (const cookie of setCookieHeader) {
        expect(cookie).toMatch(/HttpOnly/i);
        expect(cookie).toMatch(/SameSite=Strict/i);
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
    });
  });

  it('exposes all auth routes in the generated OpenAPI document', async () => {
    const response = await app.inject({ method: 'GET', url: '/docs/json' });
    const openApiDocument = response.json();

    for (const path of ['/auth/register', '/auth/login', '/auth/logout']) {
      expect(openApiDocument.paths[path]).toBeDefined();
      expect(openApiDocument.paths[path].post.tags).toContain('Auth');
    }
  });
});
