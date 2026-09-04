import { FastifyInstance } from 'fastify';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { buildApp } from '../../src/infrastructure/http/build-app';
import { prisma } from '../../src/infrastructure/database/prisma-client';

describe('Medication routes', () => {
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
    await prisma.medication.deleteMany();
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

  async function createBaby(cookie: string, csrfToken: string): Promise<string> {
    const response = await app.inject({
      method: 'POST',
      url: '/babies',
      headers: { cookie, 'x-csrf-token': csrfToken },
      payload: { name: 'Baby', birthDate: '2024-01-01', gender: 'FEMALE' },
    });

    return response.json().id;
  }

  describe('POST /babies/:babyId/medications', () => {
    it('records what was prescribed, as written', async () => {
      const { cookie, csrfToken } = await registerAndLogin('parent-medication@example.com');
      const babyId = await createBaby(cookie, csrfToken);

      const response = await app.inject({
        method: 'POST',
        url: `/babies/${babyId}/medications`,
        headers: { cookie, 'x-csrf-token': csrfToken },
        payload: {
          name: 'Vitamina D',
          dosage: '5 gotas',
          frequency: '1x ao dia',
          reason: 'Suplementação',
          prescriberName: 'Dra. Fernanda Lima',
          startedOn: '2026-01-10',
        },
      });

      expect(response.statusCode).toBe(201);
      expect(response.json()).toMatchObject({
        name: 'Vitamina D',
        dosage: '5 gotas',
        frequency: '1x ao dia',
        startedOn: '2026-01-10',
        // No recorded end: the course is open as far as this record knows, which is all it claims.
        endedOn: null,
      });
    });

    it('rejects a course that ends before it starts', async () => {
      const { cookie, csrfToken } = await registerAndLogin('parent-medication-dates@example.com');
      const babyId = await createBaby(cookie, csrfToken);

      const response = await app.inject({
        method: 'POST',
        url: `/babies/${babyId}/medications`,
        headers: { cookie, 'x-csrf-token': csrfToken },
        payload: { name: 'Amoxicilina', startedOn: '2026-01-10', endedOn: '2026-01-09' },
      });

      expect(response.statusCode).toBe(400);
    });

    it("rejects recording a medication on another user's baby", async () => {
      const { cookie: ownerCookie, csrfToken: ownerCsrfToken } = await registerAndLogin('med-owner@example.com');
      const { cookie: intruderCookie, csrfToken: intruderCsrfToken } =
        await registerAndLogin('med-intruder@example.com');
      const babyId = await createBaby(ownerCookie, ownerCsrfToken);

      const response = await app.inject({
        method: 'POST',
        url: `/babies/${babyId}/medications`,
        headers: { cookie: intruderCookie, 'x-csrf-token': intruderCsrfToken },
        payload: { name: 'Vitamina D', startedOn: '2026-01-10' },
      });

      expect(response.statusCode).toBe(404);
    });
  });

  describe('GET /babies/:babyId/medications', () => {
    it('lists the most recently started first', async () => {
      const { cookie, csrfToken } = await registerAndLogin('parent-medication-list@example.com');
      const babyId = await createBaby(cookie, csrfToken);

      for (const [name, startedOn] of [
        ['Vitamina D', '2025-06-01'],
        ['Amoxicilina', '2026-02-01'],
      ]) {
        await app.inject({
          method: 'POST',
          url: `/babies/${babyId}/medications`,
          headers: { cookie, 'x-csrf-token': csrfToken },
          payload: { name, startedOn },
        });
      }

      const response = await app.inject({
        method: 'GET',
        url: `/babies/${babyId}/medications`,
        headers: { cookie, 'x-csrf-token': csrfToken },
      });

      expect(response.statusCode).toBe(200);
      expect(response.json().map((medication: { name: string }) => medication.name)).toEqual([
        'Amoxicilina',
        'Vitamina D',
      ]);
    });
  });

  describe('PATCH /babies/:babyId/medications/:medicationId', () => {
    /**
     * Ending a course is the most common edit this route will ever get, and the three states of
     * `endedOn` all mean something: a date ends it, `null` reopens it, and an absent key leaves it
     * alone. The last one is what stops a correction to the dose from silently reopening a course
     * that had ended.
     */
    it('ends a course, and a later edit to the dose does not reopen it', async () => {
      const { cookie, csrfToken } = await registerAndLogin('parent-medication-end@example.com');
      const babyId = await createBaby(cookie, csrfToken);

      const createResponse = await app.inject({
        method: 'POST',
        url: `/babies/${babyId}/medications`,
        headers: { cookie, 'x-csrf-token': csrfToken },
        payload: { name: 'Amoxicilina', dosage: '5 ml', startedOn: '2026-01-10' },
      });
      const medicationId = createResponse.json().id;

      const endResponse = await app.inject({
        method: 'PATCH',
        url: `/babies/${babyId}/medications/${medicationId}`,
        headers: { cookie, 'x-csrf-token': csrfToken },
        payload: { endedOn: '2026-01-17' },
      });

      expect(endResponse.statusCode).toBe(200);
      expect(endResponse.json().endedOn).toBe('2026-01-17');

      const doseFixResponse = await app.inject({
        method: 'PATCH',
        url: `/babies/${babyId}/medications/${medicationId}`,
        headers: { cookie, 'x-csrf-token': csrfToken },
        payload: { dosage: '7 ml' },
      });

      expect(doseFixResponse.statusCode).toBe(200);
      expect(doseFixResponse.json().dosage).toBe('7 ml');
      expect(doseFixResponse.json().endedOn).toBe('2026-01-17');
    });

    it('refuses to reach a medication through a baby it does not belong to', async () => {
      const { cookie, csrfToken } = await registerAndLogin('parent-medication-cross@example.com');
      const firstBabyId = await createBaby(cookie, csrfToken);
      const secondBabyId = await createBaby(cookie, csrfToken);

      const createResponse = await app.inject({
        method: 'POST',
        url: `/babies/${firstBabyId}/medications`,
        headers: { cookie, 'x-csrf-token': csrfToken },
        payload: { name: 'Vitamina D', startedOn: '2026-01-10' },
      });
      const medicationId = createResponse.json().id;

      const response = await app.inject({
        method: 'PATCH',
        url: `/babies/${secondBabyId}/medications/${medicationId}`,
        headers: { cookie, 'x-csrf-token': csrfToken },
        payload: { dosage: '10 gotas' },
      });

      expect(response.statusCode).toBe(404);
    });
  });

  describe('DELETE /babies/:babyId/medications/:medicationId', () => {
    it('removes a record entered by mistake', async () => {
      const { cookie, csrfToken } = await registerAndLogin('parent-medication-delete@example.com');
      const babyId = await createBaby(cookie, csrfToken);

      const createResponse = await app.inject({
        method: 'POST',
        url: `/babies/${babyId}/medications`,
        headers: { cookie, 'x-csrf-token': csrfToken },
        payload: { name: 'Vitamina D', startedOn: '2026-01-10' },
      });
      const medicationId = createResponse.json().id;

      const deleteResponse = await app.inject({
        method: 'DELETE',
        url: `/babies/${babyId}/medications/${medicationId}`,
        headers: { cookie, 'x-csrf-token': csrfToken },
      });

      expect(deleteResponse.statusCode).toBe(204);

      const listResponse = await app.inject({
        method: 'GET',
        url: `/babies/${babyId}/medications`,
        headers: { cookie, 'x-csrf-token': csrfToken },
      });

      expect(listResponse.json()).toEqual([]);
    });
  });
});
