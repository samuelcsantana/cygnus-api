import { FastifyInstance } from 'fastify';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { buildApp } from '../../src/infrastructure/http/build-app';
import { prisma } from '../../src/infrastructure/database/prisma-client';

describe('User profile routes', () => {
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
    await prisma.baby.deleteMany();
    await prisma.user.deleteMany();
  });

  function extractCookieHeader(setCookieHeader: string | string[] | undefined): string {
    const values = Array.isArray(setCookieHeader) ? setCookieHeader : setCookieHeader ? [setCookieHeader] : [];
    return values.map((cookie) => cookie.split(';')[0]).join('; ');
  }

  function extractCsrfToken(setCookieHeader: string | string[] | undefined): string {
    const values = Array.isArray(setCookieHeader) ? setCookieHeader : setCookieHeader ? [setCookieHeader] : [];
    const csrfCookie = values.find((value) => value.startsWith('csrf_token='));
    return csrfCookie ? csrfCookie.split(';')[0].split('=')[1] : '';
  }

  async function registerAndLogin(
    email: string,
    password = 'S3cur3-Password',
  ): Promise<{ cookie: string; csrfToken: string }> {
    await app.inject({
      method: 'POST',
      url: '/auth/register',
      payload: { email, password, name: 'Jane Doe' },
    });

    const loginResponse = await app.inject({
      method: 'POST',
      url: '/auth/login',
      payload: { email, password },
    });

    return {
      cookie: extractCookieHeader(loginResponse.headers['set-cookie']),
      csrfToken: extractCsrfToken(loginResponse.headers['set-cookie']),
    };
  }

  describe('PATCH /users/me', () => {
    it('updates only the name without requiring currentPassword', async () => {
      const { cookie, csrfToken } = await registerAndLogin('name-only@example.com');

      const response = await app.inject({
        method: 'PATCH',
        url: '/users/me',
        headers: { cookie, 'x-csrf-token': csrfToken },
        payload: { name: 'Jane Smith' },
      });

      expect(response.statusCode).toBe(200);
      expect(response.json()).toMatchObject({ name: 'Jane Smith', email: 'name-only@example.com' });
    });

    it('rejects an email change without currentPassword with 400', async () => {
      const { cookie, csrfToken } = await registerAndLogin('email-no-pass@example.com');

      const response = await app.inject({
        method: 'PATCH',
        url: '/users/me',
        headers: { cookie, 'x-csrf-token': csrfToken },
        payload: { email: 'new-email@example.com' },
      });

      expect(response.statusCode).toBe(400);
    });

    it('rejects an email change with an incorrect currentPassword with 400', async () => {
      const { cookie, csrfToken } = await registerAndLogin('email-wrong-pass@example.com');

      const response = await app.inject({
        method: 'PATCH',
        url: '/users/me',
        headers: { cookie, 'x-csrf-token': csrfToken },
        payload: { email: 'new-email@example.com', currentPassword: 'wrong-password' },
      });

      expect(response.statusCode).toBe(400);
    });

    it('rejects an email already used by another registered user with 409', async () => {
      await registerAndLogin('taken@example.com');
      const { cookie, csrfToken } = await registerAndLogin('changer@example.com');

      const response = await app.inject({
        method: 'PATCH',
        url: '/users/me',
        headers: { cookie, 'x-csrf-token': csrfToken },
        payload: { email: 'taken@example.com', currentPassword: 'S3cur3-Password' },
      });

      expect(response.statusCode).toBe(409);
    });

    it('changes the password and allows logging in with the new one afterwards', async () => {
      const { cookie, csrfToken } = await registerAndLogin('password-change@example.com');

      const updateResponse = await app.inject({
        method: 'PATCH',
        url: '/users/me',
        headers: { cookie, 'x-csrf-token': csrfToken },
        payload: { password: 'New-Password1', currentPassword: 'S3cur3-Password' },
      });

      expect(updateResponse.statusCode).toBe(200);

      const loginResponse = await app.inject({
        method: 'POST',
        url: '/auth/login',
        payload: { email: 'password-change@example.com', password: 'New-Password1' },
      });

      expect(loginResponse.statusCode).toBe(200);
    });

    it('rejects a request without an access_token cookie with 401', async () => {
      const response = await app.inject({ method: 'PATCH', url: '/users/me', payload: { name: 'Anyone' } });

      expect(response.statusCode).toBe(401);
    });
  });

  describe('GET /users/me/export', () => {
    it("returns the user's profile and every baby's vaccine records, appointments and milestones", async () => {
      const { cookie, csrfToken } = await registerAndLogin('export-me@example.com');

      const createBabyResponse = await app.inject({
        method: 'POST',
        url: '/babies',
        headers: { cookie, 'x-csrf-token': csrfToken },
        payload: { name: 'Alice', birthDate: '2024-01-01', gender: 'FEMALE' },
      });
      const babyId = createBabyResponse.json().id;

      await app.inject({
        method: 'POST',
        url: `/babies/${babyId}/milestones`,
        headers: { cookie, 'x-csrf-token': csrfToken },
        payload: { title: 'Primeiro sorriso', achievedAt: '2024-03-01', category: 'SOCIAL' },
      });

      await app.inject({
        method: 'POST',
        url: `/babies/${babyId}/vaccines/adhoc`,
        headers: { cookie, 'x-csrf-token': csrfToken },
        payload: { source: 'CUSTOM', customName: 'Vacina extra', applicationDate: '2024-06-01' },
      });

      const response = await app.inject({
        method: 'GET',
        url: '/users/me/export',
        headers: { cookie, 'x-csrf-token': csrfToken },
      });

      expect(response.statusCode).toBe(200);
      const body = response.json();

      expect(body.user).toMatchObject({ email: 'export-me@example.com', name: 'Jane Doe' });
      expect(body.user.passwordHash).toBeUndefined();
      expect(body.babies).toHaveLength(1);
      expect(body.babies[0].profile).toMatchObject({ id: babyId, name: 'Alice' });
      expect(body.babies[0].milestones).toHaveLength(1);
      expect(body.babies[0].milestones[0].title).toBe('Primeiro sorriso');
      expect(body.babies[0].vaccineRecords).toHaveLength(1);
      expect(body.babies[0].vaccineRecords[0]).toMatchObject({ source: 'CUSTOM', customName: 'Vacina extra' });
      expect(body.babies[0].appointments).toEqual([]);
    });

    it('rejects a request without an access_token cookie with 401', async () => {
      const response = await app.inject({ method: 'GET', url: '/users/me/export' });

      expect(response.statusCode).toBe(401);
    });
  });

  describe('DELETE /users/me', () => {
    it('rejects a request without currentPassword with 400', async () => {
      const { cookie, csrfToken } = await registerAndLogin('delete-no-pass@example.com');

      const response = await app.inject({ method: 'DELETE', url: '/users/me', headers: { cookie, 'x-csrf-token': csrfToken }, payload: {} });

      expect(response.statusCode).toBe(400);
    });

    it('rejects an incorrect currentPassword with 400', async () => {
      const { cookie, csrfToken } = await registerAndLogin('delete-wrong-pass@example.com');

      const response = await app.inject({
        method: 'DELETE',
        url: '/users/me',
        headers: { cookie, 'x-csrf-token': csrfToken },
        payload: { currentPassword: 'wrong-password' },
      });

      expect(response.statusCode).toBe(400);
    });

    it('deletes the account, clears cookies, and revokes the session', async () => {
      const { cookie, csrfToken } = await registerAndLogin('delete-me@example.com');

      const response = await app.inject({
        method: 'DELETE',
        url: '/users/me',
        headers: { cookie, 'x-csrf-token': csrfToken },
        payload: { currentPassword: 'S3cur3-Password' },
      });

      expect(response.statusCode).toBe(204);

      const setCookieHeader = response.headers['set-cookie'];
      const cookies = Array.isArray(setCookieHeader) ? setCookieHeader : [setCookieHeader as string];
      expect(cookies.some((c) => c.includes('access_token=;'))).toBe(true);
      expect(cookies.some((c) => c.includes('refresh_token=;'))).toBe(true);

      const meResponse = await app.inject({ method: 'GET', url: '/auth/me', headers: { cookie, 'x-csrf-token': csrfToken } });
      expect(meResponse.statusCode).toBe(401);

      const loginResponse = await app.inject({
        method: 'POST',
        url: '/auth/login',
        payload: { email: 'delete-me@example.com', password: 'S3cur3-Password' },
      });
      expect(loginResponse.statusCode).toBe(401);
    });

    it('rejects a request without an access_token cookie with 401', async () => {
      const response = await app.inject({ method: 'DELETE', url: '/users/me', payload: { currentPassword: 'x' } });

      expect(response.statusCode).toBe(401);
    });
  });

  it('exposes all user routes in the generated OpenAPI document', async () => {
    const response = await app.inject({ method: 'GET', url: '/docs/json' });
    const openApiDocument = response.json();

    expect(openApiDocument.paths['/users/me']).toBeDefined();
    expect(openApiDocument.paths['/users/me'].patch.tags).toContain('Users');
    expect(openApiDocument.paths['/users/me'].delete.tags).toContain('Users');
    expect(openApiDocument.paths['/users/me/export'].get.tags).toContain('Users');
  });
});
