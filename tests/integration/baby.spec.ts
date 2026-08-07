import { FastifyInstance } from 'fastify';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { buildApp } from '../../src/infrastructure/http/build-app';
import { prisma } from '../../src/infrastructure/database/prisma-client';

describe('Baby routes', () => {
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

  async function registerAndLogin(email: string): Promise<{ cookie: string; csrfToken: string }> {
    await app.inject({
      method: 'POST',
      url: '/auth/register',
      payload: { email, password: 'S3cur3-Password', name: 'Parent' },
    });

    const loginResponse = await app.inject({
      method: 'POST',
      url: '/auth/login',
      payload: { email, password: 'S3cur3-Password' },
    });

    return {
      cookie: extractCookieHeader(loginResponse.headers['set-cookie']),
      csrfToken: extractCsrfToken(loginResponse.headers['set-cookie']),
    };
  }

  describe('POST /babies', () => {
    it('creates a baby profile owned by the authenticated user', async () => {
      const { cookie, csrfToken } = await registerAndLogin('parent-create@example.com');

      const response = await app.inject({
        method: 'POST',
        url: '/babies',
        headers: { cookie, 'x-csrf-token': csrfToken },
        payload: { name: 'Alice', birthDate: '2024-03-10', gender: 'FEMALE', allergies: ['lactose'] },
      });

      expect(response.statusCode).toBe(201);

      const body = response.json();
      expect(body).toMatchObject({
        name: 'Alice',
        birthDate: '2024-03-10',
        gender: 'FEMALE',
        allergies: ['lactose'],
      });
      expect(body.id).toBeDefined();
      expect(body.userId).toBeDefined();
    });

    it('rejects a future birth date with 400', async () => {
      const { cookie, csrfToken } = await registerAndLogin('parent-future@example.com');
      const futureDate = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);

      const response = await app.inject({
        method: 'POST',
        url: '/babies',
        headers: { cookie, 'x-csrf-token': csrfToken },
        payload: { name: 'Future Baby', birthDate: futureDate, gender: 'MALE' },
      });

      expect(response.statusCode).toBe(400);
    });

    it('rejects the request without authentication', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/babies',
        payload: { name: 'Alice', birthDate: '2024-03-10', gender: 'FEMALE' },
      });

      expect(response.statusCode).toBe(401);
    });

    it('accepts and returns an avatarColor', async () => {
      const { cookie, csrfToken } = await registerAndLogin('parent-avatar-color@example.com');

      const response = await app.inject({
        method: 'POST',
        url: '/babies',
        headers: { cookie, 'x-csrf-token': csrfToken },
        payload: { name: 'Alice', birthDate: '2024-03-10', gender: 'FEMALE', avatarColor: '#2A9D8F' },
      });

      expect(response.statusCode).toBe(201);
      expect(response.json().avatarColor).toBe('#2A9D8F');
    });

    it('rejects an avatarColor that is not a hex color', async () => {
      const { cookie, csrfToken } = await registerAndLogin('parent-bad-avatar-color@example.com');

      const response = await app.inject({
        method: 'POST',
        url: '/babies',
        headers: { cookie, 'x-csrf-token': csrfToken },
        payload: { name: 'Alice', birthDate: '2024-03-10', gender: 'FEMALE', avatarColor: 'teal' },
      });

      expect(response.statusCode).toBe(400);
    });
  });

  describe('user isolation', () => {
    it("prevents a user from reading, updating or listing another user's baby", async () => {
      const { cookie: ownerCookie, csrfToken: ownerCsrfToken } = await registerAndLogin('owner@example.com');
      const { cookie: intruderCookie, csrfToken: intruderCsrfToken } = await registerAndLogin('intruder@example.com');

      const createResponse = await app.inject({
        method: 'POST',
        url: '/babies',
        headers: { cookie: ownerCookie, 'x-csrf-token': ownerCsrfToken },
        payload: { name: 'Bob', birthDate: '2023-06-01', gender: 'MALE' },
      });

      const babyId = createResponse.json().id;

      const getAsIntruder = await app.inject({
        method: 'GET',
        url: `/babies/${babyId}`,
        headers: { cookie: intruderCookie, 'x-csrf-token': intruderCsrfToken },
      });
      expect(getAsIntruder.statusCode).toBe(404);

      const updateAsIntruder = await app.inject({
        method: 'PATCH',
        url: `/babies/${babyId}`,
        headers: { cookie: intruderCookie, 'x-csrf-token': intruderCsrfToken },
        payload: { name: 'Hacked Name' },
      });
      expect(updateAsIntruder.statusCode).toBe(404);

      const deleteAsIntruder = await app.inject({
        method: 'DELETE',
        url: `/babies/${babyId}`,
        headers: { cookie: intruderCookie, 'x-csrf-token': intruderCsrfToken },
      });
      expect(deleteAsIntruder.statusCode).toBe(404);

      const listAsIntruder = await app.inject({
        method: 'GET',
        url: '/babies',
        headers: { cookie: intruderCookie, 'x-csrf-token': intruderCsrfToken },
      });
      expect(listAsIntruder.statusCode).toBe(200);
      expect(listAsIntruder.json()).toEqual([]);

      const getAsOwner = await app.inject({
        method: 'GET',
        url: `/babies/${babyId}`,
        headers: { cookie: ownerCookie, 'x-csrf-token': ownerCsrfToken },
      });
      expect(getAsOwner.statusCode).toBe(200);
      expect(getAsOwner.json().name).toBe('Bob');
    });
  });

  describe('PATCH /babies/:babyId', () => {
    it('updates only the provided fields', async () => {
      const { cookie, csrfToken } = await registerAndLogin('parent-update@example.com');

      const createResponse = await app.inject({
        method: 'POST',
        url: '/babies',
        headers: { cookie, 'x-csrf-token': csrfToken },
        payload: { name: 'Carla', birthDate: '2022-11-20', gender: 'FEMALE' },
      });
      const babyId = createResponse.json().id;

      const updateResponse = await app.inject({
        method: 'PATCH',
        url: `/babies/${babyId}`,
        headers: { cookie, 'x-csrf-token': csrfToken },
        payload: { bloodType: 'O+' },
      });

      expect(updateResponse.statusCode).toBe(200);
      const body = updateResponse.json();
      expect(body.bloodType).toBe('O+');
      expect(body.name).toBe('Carla');
      expect(body.birthDate).toBe('2022-11-20');
    });

    it('updates the avatarColor independently of the avatarUrl', async () => {
      const { cookie, csrfToken } = await registerAndLogin('parent-update-avatar-color@example.com');

      const createResponse = await app.inject({
        method: 'POST',
        url: '/babies',
        headers: { cookie, 'x-csrf-token': csrfToken },
        payload: { name: 'Dora', birthDate: '2022-11-20', gender: 'FEMALE' },
      });
      const babyId = createResponse.json().id;

      const updateResponse = await app.inject({
        method: 'PATCH',
        url: `/babies/${babyId}`,
        headers: { cookie, 'x-csrf-token': csrfToken },
        payload: { avatarColor: '#F4A261' },
      });

      expect(updateResponse.statusCode).toBe(200);
      const body = updateResponse.json();
      expect(body.avatarColor).toBe('#F4A261');
      expect(body.avatarUrl).toBeNull();
    });

    it('returns 404 for a non-existent baby', async () => {
      const { cookie, csrfToken } = await registerAndLogin('parent-missing@example.com');

      const response = await app.inject({
        method: 'PATCH',
        url: '/babies/00000000-0000-0000-0000-000000000000',
        headers: { cookie, 'x-csrf-token': csrfToken },
        payload: { name: 'Nobody' },
      });

      expect(response.statusCode).toBe(404);
    });
  });

  describe('DELETE /babies/:babyId', () => {
    it('deletes the baby and cascades to its dependent records', async () => {
      const { cookie, csrfToken } = await registerAndLogin('parent-delete@example.com');

      const createResponse = await app.inject({
        method: 'POST',
        url: '/babies',
        headers: { cookie, 'x-csrf-token': csrfToken },
        payload: { name: 'Dana', birthDate: '2023-02-14', gender: 'FEMALE' },
      });
      const babyId = createResponse.json().id;

      const deleteResponse = await app.inject({
        method: 'DELETE',
        url: `/babies/${babyId}`,
        headers: { cookie, 'x-csrf-token': csrfToken },
      });
      expect(deleteResponse.statusCode).toBe(204);

      const getAfterDelete = await app.inject({
        method: 'GET',
        url: `/babies/${babyId}`,
        headers: { cookie, 'x-csrf-token': csrfToken },
      });
      expect(getAfterDelete.statusCode).toBe(404);
    });

    it('returns 404 for a non-existent baby', async () => {
      const { cookie, csrfToken } = await registerAndLogin('parent-delete-missing@example.com');

      const response = await app.inject({
        method: 'DELETE',
        url: '/babies/00000000-0000-0000-0000-000000000000',
        headers: { cookie, 'x-csrf-token': csrfToken },
      });

      expect(response.statusCode).toBe(404);
    });

    it('rejects the request without authentication', async () => {
      const response = await app.inject({
        method: 'DELETE',
        url: '/babies/00000000-0000-0000-0000-000000000000',
      });

      expect(response.statusCode).toBe(401);
    });
  });

  it('exposes all baby routes in the generated OpenAPI document', async () => {
    const response = await app.inject({ method: 'GET', url: '/docs/json' });
    const openApiDocument = response.json();

    expect(openApiDocument.paths['/babies'].post.tags).toContain('Babies');
    expect(openApiDocument.paths['/babies'].get.tags).toContain('Babies');
    expect(openApiDocument.paths['/babies/{babyId}'].get.tags).toContain('Babies');
    expect(openApiDocument.paths['/babies/{babyId}'].patch.tags).toContain('Babies');
    expect(openApiDocument.paths['/babies/{babyId}'].delete.tags).toContain('Babies');
  });
});
