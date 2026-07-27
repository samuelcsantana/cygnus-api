import { randomUUID } from 'node:crypto';
import { FastifyInstance } from 'fastify';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { buildApp } from '../../src/infrastructure/http/build-app';
import { prisma } from '../../src/infrastructure/database/prisma-client';

describe('Notification routes', () => {
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
    await prisma.notification.deleteMany();
    await prisma.baby.deleteMany();
    await prisma.user.deleteMany();
  });

  function extractCookieHeader(setCookieHeader: string | string[] | undefined): string {
    const values = Array.isArray(setCookieHeader) ? setCookieHeader : setCookieHeader ? [setCookieHeader] : [];
    return values.map((cookie) => cookie.split(';')[0]).join('; ');
  }

  async function registerAndLogin(email: string): Promise<{ cookie: string; userId: string }> {
    const registerResponse = await app.inject({
      method: 'POST',
      url: '/auth/register',
      payload: { email, password: 'S3cur3-Password', name: 'Parent' },
    });

    const loginResponse = await app.inject({
      method: 'POST',
      url: '/auth/login',
      payload: { email, password: 'S3cur3-Password' },
    });

    return { cookie: extractCookieHeader(loginResponse.headers['set-cookie']), userId: registerResponse.json().id };
  }

  async function createBaby(cookie: string): Promise<string> {
    const response = await app.inject({
      method: 'POST',
      url: '/babies',
      headers: { cookie },
      payload: { name: 'Baby', birthDate: '2024-01-01', gender: 'FEMALE' },
    });

    return response.json().id;
  }

  async function seedNotification(userId: string, babyId: string): Promise<string> {
    const notification = await prisma.notification.create({
      data: {
        id: randomUUID(),
        userId,
        babyId,
        type: 'VACCINE_DELAYED',
        referenceId: randomUUID(),
        title: 'Vacina atrasada: BCG',
        message: 'A vacina BCG de Baby está atrasada.',
      },
    });

    return notification.id;
  }

  describe('GET /notifications', () => {
    it("lists only the authenticated user's notifications", async () => {
      const owner = await registerAndLogin('notif-owner@example.com');
      const other = await registerAndLogin('notif-other@example.com');
      const ownerBabyId = await createBaby(owner.cookie);
      const otherBabyId = await createBaby(other.cookie);

      await seedNotification(owner.userId, ownerBabyId);
      await seedNotification(other.userId, otherBabyId);

      const response = await app.inject({ method: 'GET', url: '/notifications', headers: { cookie: owner.cookie } });

      expect(response.statusCode).toBe(200);
      const notifications = response.json();
      expect(notifications).toHaveLength(1);
      expect(notifications[0]).toMatchObject({ babyId: ownerBabyId, type: 'VACCINE_DELAYED', readAt: null });
    });

    it('rejects the request without authentication', async () => {
      const response = await app.inject({ method: 'GET', url: '/notifications' });
      expect(response.statusCode).toBe(401);
    });
  });

  describe('PATCH /notifications/:notificationId/read', () => {
    it('marks a notification as read', async () => {
      const owner = await registerAndLogin('notif-read@example.com');
      const babyId = await createBaby(owner.cookie);
      const notificationId = await seedNotification(owner.userId, babyId);

      const response = await app.inject({
        method: 'PATCH',
        url: `/notifications/${notificationId}/read`,
        headers: { cookie: owner.cookie },
      });

      expect(response.statusCode).toBe(200);
      const body = response.json();
      expect(body.readAt).not.toBeNull();
    });

    it("returns 404 when marking another user's notification as read", async () => {
      const owner = await registerAndLogin('notif-read-owner@example.com');
      const intruder = await registerAndLogin('notif-read-intruder@example.com');
      const babyId = await createBaby(owner.cookie);
      const notificationId = await seedNotification(owner.userId, babyId);

      const response = await app.inject({
        method: 'PATCH',
        url: `/notifications/${notificationId}/read`,
        headers: { cookie: intruder.cookie },
      });

      expect(response.statusCode).toBe(404);
    });

    it('returns 404 for a notification that does not exist', async () => {
      const owner = await registerAndLogin('notif-read-missing@example.com');

      const response = await app.inject({
        method: 'PATCH',
        url: `/notifications/00000000-0000-0000-0000-000000000000/read`,
        headers: { cookie: owner.cookie },
      });

      expect(response.statusCode).toBe(404);
    });
  });

  it('exposes all notification routes in the generated OpenAPI document', async () => {
    const response = await app.inject({ method: 'GET', url: '/docs/json' });
    const openApiDocument = response.json();

    expect(openApiDocument.paths['/notifications'].get.tags).toContain('Notifications');
    expect(openApiDocument.paths['/notifications/{notificationId}/read'].patch.tags).toContain('Notifications');
  });
});
