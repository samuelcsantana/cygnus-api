import { FastifyInstance } from 'fastify';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { buildApp } from '../../src/infrastructure/http/build-app';
import { prisma } from '../../src/infrastructure/database/prisma-client';

describe('Milestone routes', () => {
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
    await prisma.milestone.deleteMany();
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

  async function createBaby(cookie: string, csrfToken: string, birthDate: string): Promise<string> {
    const response = await app.inject({
      method: 'POST',
      url: '/babies',
      headers: { cookie, 'x-csrf-token': csrfToken },
      payload: { name: 'Baby', birthDate, gender: 'FEMALE' },
    });

    return response.json().id;
  }

  describe('POST /babies/:babyId/milestones', () => {
    it('records a new milestone', async () => {
      const { cookie, csrfToken } = await registerAndLogin('parent-milestone@example.com');
      const babyId = await createBaby(cookie, csrfToken, '2024-01-01');

      const response = await app.inject({
        method: 'POST',
        url: `/babies/${babyId}/milestones`,
        headers: { cookie, 'x-csrf-token': csrfToken },
        payload: {
          title: 'Primeiro sorriso',
          achievedAt: '2024-03-01',
          category: 'SOCIAL',
          description: 'Sorriu para a mãe',
        },
      });

      expect(response.statusCode).toBe(201);
      expect(response.json()).toMatchObject({
        babyId,
        title: 'Primeiro sorriso',
        achievedAt: '2024-03-01',
        category: 'SOCIAL',
        description: 'Sorriu para a mãe',
      });
    });

    it('rejects an achievedAt in the future', async () => {
      const { cookie, csrfToken } = await registerAndLogin('parent-future-milestone@example.com');
      const babyId = await createBaby(cookie, csrfToken, '2024-01-01');
      const futureDate = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);

      const response = await app.inject({
        method: 'POST',
        url: `/babies/${babyId}/milestones`,
        headers: { cookie, 'x-csrf-token': csrfToken },
        payload: { title: 'Andar', achievedAt: futureDate, category: 'MOTOR' },
      });

      expect(response.statusCode).toBe(400);
    });

    it("rejects an achievedAt before the baby's birth date", async () => {
      const { cookie, csrfToken } = await registerAndLogin('parent-before-birth@example.com');
      const babyId = await createBaby(cookie, csrfToken, '2024-06-01');

      const response = await app.inject({
        method: 'POST',
        url: `/babies/${babyId}/milestones`,
        headers: { cookie, 'x-csrf-token': csrfToken },
        payload: { title: 'Impossível', achievedAt: '2024-01-01', category: 'OTHER' },
      });

      expect(response.statusCode).toBe(400);
    });

    it("rejects recording for another user's baby", async () => {
      const { cookie: ownerCookie, csrfToken: ownerCsrfToken } = await registerAndLogin('milestone-owner@example.com');
      const { cookie: intruderCookie, csrfToken: intruderCsrfToken } = await registerAndLogin('milestone-intruder@example.com');
      const babyId = await createBaby(ownerCookie, ownerCsrfToken, '2024-01-01');

      const response = await app.inject({
        method: 'POST',
        url: `/babies/${babyId}/milestones`,
        headers: { cookie: intruderCookie, 'x-csrf-token': intruderCsrfToken },
        payload: { title: 'Primeiro sorriso', achievedAt: '2024-03-01', category: 'SOCIAL' },
      });

      expect(response.statusCode).toBe(404);
    });
  });

  describe('GET /babies/:babyId/milestones', () => {
    it('lists milestones ordered by achieved date', async () => {
      const { cookie, csrfToken } = await registerAndLogin('parent-list-milestones@example.com');
      const babyId = await createBaby(cookie, csrfToken, '2024-01-01');

      await app.inject({
        method: 'POST',
        url: `/babies/${babyId}/milestones`,
        headers: { cookie, 'x-csrf-token': csrfToken },
        payload: { title: 'Segundo marco', achievedAt: '2024-06-01', category: 'MOTOR' },
      });
      await app.inject({
        method: 'POST',
        url: `/babies/${babyId}/milestones`,
        headers: { cookie, 'x-csrf-token': csrfToken },
        payload: { title: 'Primeiro marco', achievedAt: '2024-03-01', category: 'SOCIAL' },
      });

      const response = await app.inject({ method: 'GET', url: `/babies/${babyId}/milestones`, headers: { cookie, 'x-csrf-token': csrfToken } });

      expect(response.statusCode).toBe(200);
      const milestones = response.json();
      expect(milestones).toHaveLength(2);
      expect(milestones[0].title).toBe('Primeiro marco');
      expect(milestones[1].title).toBe('Segundo marco');
    });

    it('filters by search across title and description, case-insensitively', async () => {
      const { cookie, csrfToken } = await registerAndLogin('parent-search-milestones@example.com');
      const babyId = await createBaby(cookie, csrfToken, '2024-01-01');

      await app.inject({
        method: 'POST',
        url: `/babies/${babyId}/milestones`,
        headers: { cookie, 'x-csrf-token': csrfToken },
        payload: { title: 'Primeiro sorriso', achievedAt: '2024-03-01', category: 'SOCIAL' },
      });
      await app.inject({
        method: 'POST',
        url: `/babies/${babyId}/milestones`,
        headers: { cookie, 'x-csrf-token': csrfToken },
        payload: {
          title: 'Primeiros passos',
          achievedAt: '2024-08-01',
          category: 'MOTOR',
          description: 'Andou sozinho pela sala',
        },
      });

      const byTitle = await app.inject({
        method: 'GET',
        url: `/babies/${babyId}/milestones?search=SORRISO`,
        headers: { cookie, 'x-csrf-token': csrfToken },
      });
      expect(byTitle.statusCode).toBe(200);
      expect(byTitle.json()).toHaveLength(1);
      expect(byTitle.json()[0].title).toBe('Primeiro sorriso');

      const byDescription = await app.inject({
        method: 'GET',
        url: `/babies/${babyId}/milestones?search=sozinho`,
        headers: { cookie, 'x-csrf-token': csrfToken },
      });
      expect(byDescription.statusCode).toBe(200);
      expect(byDescription.json()).toHaveLength(1);
      expect(byDescription.json()[0].title).toBe('Primeiros passos');

      const noMatch = await app.inject({
        method: 'GET',
        url: `/babies/${babyId}/milestones?search=nonexistent`,
        headers: { cookie, 'x-csrf-token': csrfToken },
      });
      expect(noMatch.statusCode).toBe(200);
      expect(noMatch.json()).toHaveLength(0);
    });

    it('returns every milestone when search is omitted', async () => {
      const { cookie, csrfToken } = await registerAndLogin('parent-no-search-milestones@example.com');
      const babyId = await createBaby(cookie, csrfToken, '2024-01-01');

      await app.inject({
        method: 'POST',
        url: `/babies/${babyId}/milestones`,
        headers: { cookie, 'x-csrf-token': csrfToken },
        payload: { title: 'Primeiro sorriso', achievedAt: '2024-03-01', category: 'SOCIAL' },
      });
      await app.inject({
        method: 'POST',
        url: `/babies/${babyId}/milestones`,
        headers: { cookie, 'x-csrf-token': csrfToken },
        payload: { title: 'Primeiros passos', achievedAt: '2024-08-01', category: 'MOTOR' },
      });

      const response = await app.inject({
        method: 'GET',
        url: `/babies/${babyId}/milestones`,
        headers: { cookie, 'x-csrf-token': csrfToken },
      });

      expect(response.statusCode).toBe(200);
      expect(response.json()).toHaveLength(2);
    });
  });

  describe('PATCH /babies/:babyId/milestones/:milestoneId', () => {
    it('updates only the provided fields', async () => {
      const { cookie, csrfToken } = await registerAndLogin('parent-update-milestone@example.com');
      const babyId = await createBaby(cookie, csrfToken, '2024-01-01');

      const createResponse = await app.inject({
        method: 'POST',
        url: `/babies/${babyId}/milestones`,
        headers: { cookie, 'x-csrf-token': csrfToken },
        payload: { title: 'Primeiro sorriso', achievedAt: '2024-03-01', category: 'SOCIAL' },
      });
      const milestoneId = createResponse.json().id;

      const response = await app.inject({
        method: 'PATCH',
        url: `/babies/${babyId}/milestones/${milestoneId}`,
        headers: { cookie, 'x-csrf-token': csrfToken },
        payload: { photoUrl: 'https://example.com/photo.jpg' },
      });

      expect(response.statusCode).toBe(200);
      const body = response.json();
      expect(body.photoUrl).toBe('https://example.com/photo.jpg');
      expect(body.title).toBe('Primeiro sorriso');
      expect(body.achievedAt).toBe('2024-03-01');
    });

    it('returns 404 when updating a milestone that belongs to another user', async () => {
      const { cookie: ownerCookie, csrfToken: ownerCsrfToken } = await registerAndLogin('milestone-update-owner@example.com');
      const { cookie: intruderCookie, csrfToken: intruderCsrfToken } = await registerAndLogin('milestone-update-intruder@example.com');
      const babyId = await createBaby(ownerCookie, ownerCsrfToken, '2024-01-01');

      const createResponse = await app.inject({
        method: 'POST',
        url: `/babies/${babyId}/milestones`,
        headers: { cookie: ownerCookie, 'x-csrf-token': ownerCsrfToken },
        payload: { title: 'Primeiro sorriso', achievedAt: '2024-03-01', category: 'SOCIAL' },
      });
      const milestoneId = createResponse.json().id;

      const response = await app.inject({
        method: 'PATCH',
        url: `/babies/${babyId}/milestones/${milestoneId}`,
        headers: { cookie: intruderCookie, 'x-csrf-token': intruderCsrfToken },
        payload: { title: 'Hacked' },
      });

      expect(response.statusCode).toBe(404);
    });
  });

  describe('DELETE /babies/:babyId/milestones/:milestoneId', () => {
    it('deletes the milestone', async () => {
      const { cookie, csrfToken } = await registerAndLogin('parent-delete-milestone@example.com');
      const babyId = await createBaby(cookie, csrfToken, '2024-01-01');

      const createResponse = await app.inject({
        method: 'POST',
        url: `/babies/${babyId}/milestones`,
        headers: { cookie, 'x-csrf-token': csrfToken },
        payload: { title: 'Primeiro sorriso', achievedAt: '2024-03-01', category: 'SOCIAL' },
      });
      const milestoneId = createResponse.json().id;

      const deleteResponse = await app.inject({
        method: 'DELETE',
        url: `/babies/${babyId}/milestones/${milestoneId}`,
        headers: { cookie, 'x-csrf-token': csrfToken },
      });
      expect(deleteResponse.statusCode).toBe(204);

      const getResponse = await app.inject({
        method: 'GET',
        url: `/babies/${babyId}/milestones/${milestoneId}`,
        headers: { cookie, 'x-csrf-token': csrfToken },
      });
      expect(getResponse.statusCode).toBe(404);
    });

    it('returns 404 when deleting a milestone that belongs to another user', async () => {
      const { cookie: ownerCookie, csrfToken: ownerCsrfToken } = await registerAndLogin(
        'milestone-delete-owner@example.com',
      );
      const { cookie: intruderCookie, csrfToken: intruderCsrfToken } = await registerAndLogin(
        'milestone-delete-intruder@example.com',
      );
      const babyId = await createBaby(ownerCookie, ownerCsrfToken, '2024-01-01');

      const createResponse = await app.inject({
        method: 'POST',
        url: `/babies/${babyId}/milestones`,
        headers: { cookie: ownerCookie, 'x-csrf-token': ownerCsrfToken },
        payload: { title: 'Primeiro sorriso', achievedAt: '2024-03-01', category: 'SOCIAL' },
      });
      const milestoneId = createResponse.json().id;

      const response = await app.inject({
        method: 'DELETE',
        url: `/babies/${babyId}/milestones/${milestoneId}`,
        headers: { cookie: intruderCookie, 'x-csrf-token': intruderCsrfToken },
      });

      expect(response.statusCode).toBe(404);
    });

    it('returns 404 for a milestone that does not exist', async () => {
      const { cookie, csrfToken } = await registerAndLogin('parent-delete-missing-milestone@example.com');
      const babyId = await createBaby(cookie, csrfToken, '2024-01-01');

      const response = await app.inject({
        method: 'DELETE',
        url: `/babies/${babyId}/milestones/00000000-0000-0000-0000-000000000000`,
        headers: { cookie, 'x-csrf-token': csrfToken },
      });

      expect(response.statusCode).toBe(404);
    });

    it('rejects a mutating request without a matching CSRF header with 403', async () => {
      const { cookie, csrfToken } = await registerAndLogin('parent-csrf-milestone@example.com');
      const babyId = await createBaby(cookie, csrfToken, '2024-01-01');

      const createResponse = await app.inject({
        method: 'POST',
        url: `/babies/${babyId}/milestones`,
        headers: { cookie, 'x-csrf-token': csrfToken },
        payload: { title: 'Primeiro sorriso', achievedAt: '2024-03-01', category: 'SOCIAL' },
      });
      const milestoneId = createResponse.json().id;

      const response = await app.inject({
        method: 'DELETE',
        url: `/babies/${babyId}/milestones/${milestoneId}`,
        headers: { cookie },
      });

      expect(response.statusCode).toBe(403);
    });
  });

  it('exposes all milestone routes in the generated OpenAPI document', async () => {
    const response = await app.inject({ method: 'GET', url: '/docs/json' });
    const openApiDocument = response.json();

    expect(openApiDocument.paths['/babies/{babyId}/milestones'].post.tags).toContain('Milestones');
    expect(openApiDocument.paths['/babies/{babyId}/milestones'].get.tags).toContain('Milestones');
    expect(openApiDocument.paths['/babies/{babyId}/milestones/{milestoneId}'].get.tags).toContain('Milestones');
    expect(openApiDocument.paths['/babies/{babyId}/milestones/{milestoneId}'].patch.tags).toContain('Milestones');
    expect(openApiDocument.paths['/babies/{babyId}/milestones/{milestoneId}'].delete.tags).toContain('Milestones');
  });
});
