import { FastifyInstance } from 'fastify';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { buildApp } from '../../src/infrastructure/http/build-app';
import { prisma } from '../../src/infrastructure/database/prisma-client';

describe('Specialist routes', () => {
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
    await prisma.appointment.deleteMany();
    await prisma.specialist.deleteMany();
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

  async function createSpecialist(
    cookie: string,
    csrfToken: string,
    babyId: string,
    payload: Record<string, unknown> = {},
  ): Promise<string> {
    const response = await app.inject({
      method: 'POST',
      url: `/babies/${babyId}/specialists`,
      headers: { cookie, 'x-csrf-token': csrfToken },
      payload: { name: 'Dra. Fernanda Lima', specialty: 'Pediatria', phone: '+55 11 99999-0000', ...payload },
    });

    return response.json().id;
  }

  describe('POST /babies/:babyId/specialists', () => {
    it('saves a professional with the phone number, which is the point of the table', async () => {
      const { cookie, csrfToken } = await registerAndLogin('parent-specialist@example.com');
      const babyId = await createBaby(cookie, csrfToken);

      const response = await app.inject({
        method: 'POST',
        url: `/babies/${babyId}/specialists`,
        headers: { cookie, 'x-csrf-token': csrfToken },
        payload: { name: '  Dra. Fernanda Lima  ', specialty: 'Pediatria', phone: '+55 11 99999-0000' },
      });

      expect(response.statusCode).toBe(201);
      expect(response.json()).toMatchObject({
        name: 'Dra. Fernanda Lima',
        specialty: 'Pediatria',
        phone: '+55 11 99999-0000',
      });
    });

    it("rejects saving a specialist on another user's baby", async () => {
      const { cookie: ownerCookie, csrfToken: ownerCsrfToken } = await registerAndLogin('spec-owner@example.com');
      const { cookie: intruderCookie, csrfToken: intruderCsrfToken } =
        await registerAndLogin('spec-intruder@example.com');
      const babyId = await createBaby(ownerCookie, ownerCsrfToken);

      const response = await app.inject({
        method: 'POST',
        url: `/babies/${babyId}/specialists`,
        headers: { cookie: intruderCookie, 'x-csrf-token': intruderCsrfToken },
        payload: { name: 'Dra. Fernanda Lima' },
      });

      expect(response.statusCode).toBe(404);
    });
  });

  describe('GET /babies/:babyId/specialists', () => {
    it('lists by name and never leaks another baby’s list', async () => {
      const { cookie, csrfToken } = await registerAndLogin('parent-specialist-list@example.com');
      const firstBabyId = await createBaby(cookie, csrfToken);
      const secondBabyId = await createBaby(cookie, csrfToken);

      // Without the "Dr."/"Dra." prefixes on purpose: ordering is by the stored string, so a
      // fixture that carried them would be asserting how Postgres collates a full stop, not that
      // the list comes back alphabetically.
      await createSpecialist(cookie, csrfToken, firstBabyId, { name: 'Bruno Alves' });
      await createSpecialist(cookie, csrfToken, firstBabyId, { name: 'Ana Souza' });
      await createSpecialist(cookie, csrfToken, secondBabyId, { name: 'Carla Dias' });

      const response = await app.inject({
        method: 'GET',
        url: `/babies/${firstBabyId}/specialists`,
        headers: { cookie, 'x-csrf-token': csrfToken },
      });

      expect(response.statusCode).toBe(200);
      expect(response.json().map((specialist: { name: string }) => specialist.name)).toEqual([
        'Ana Souza',
        'Bruno Alves',
      ]);
    });
  });

  describe('PATCH /babies/:babyId/specialists/:specialistId', () => {
    it('updates the phone without touching the rest', async () => {
      const { cookie, csrfToken } = await registerAndLogin('parent-specialist-patch@example.com');
      const babyId = await createBaby(cookie, csrfToken);
      const specialistId = await createSpecialist(cookie, csrfToken, babyId);

      const response = await app.inject({
        method: 'PATCH',
        url: `/babies/${babyId}/specialists/${specialistId}`,
        headers: { cookie, 'x-csrf-token': csrfToken },
        payload: { phone: '+55 11 98888-1111' },
      });

      expect(response.statusCode).toBe(200);
      expect(response.json()).toMatchObject({
        name: 'Dra. Fernanda Lima',
        specialty: 'Pediatria',
        phone: '+55 11 98888-1111',
      });
    });

    it('refuses to reach a specialist through a baby it does not belong to', async () => {
      const { cookie, csrfToken } = await registerAndLogin('parent-specialist-cross@example.com');
      const firstBabyId = await createBaby(cookie, csrfToken);
      const secondBabyId = await createBaby(cookie, csrfToken);
      const specialistId = await createSpecialist(cookie, csrfToken, firstBabyId);

      // Both babies belong to the same user, so the access check passes and only the babyId
      // comparison inside the use case stands between the caller and the wrong row.
      const response = await app.inject({
        method: 'PATCH',
        url: `/babies/${secondBabyId}/specialists/${specialistId}`,
        headers: { cookie, 'x-csrf-token': csrfToken },
        payload: { phone: '+55 11 98888-1111' },
      });

      expect(response.statusCode).toBe(404);
    });
  });

  describe('DELETE /babies/:babyId/specialists/:specialistId', () => {
    /**
     * The guarantee this whole feature rests on: tidying the address book must not rewrite
     * history. The appointment keeps its `doctorName` — the name as typed on the day — and only
     * loses the link.
     */
    it('removes the specialist and leaves a recorded visit intact', async () => {
      const { cookie, csrfToken } = await registerAndLogin('parent-specialist-delete@example.com');
      const babyId = await createBaby(cookie, csrfToken);
      const specialistId = await createSpecialist(cookie, csrfToken, babyId);

      const appointmentResponse = await app.inject({
        method: 'POST',
        url: `/babies/${babyId}/appointments`,
        headers: { cookie, 'x-csrf-token': csrfToken },
        payload: {
          scheduledAt: '2020-01-01T10:00:00.000Z',
          doctorName: 'Dra. Fernanda Lima',
          status: 'COMPLETED',
          specialistId,
        },
      });

      expect(appointmentResponse.statusCode).toBe(201);
      expect(appointmentResponse.json().specialistId).toBe(specialistId);
      const appointmentId = appointmentResponse.json().id;

      const deleteResponse = await app.inject({
        method: 'DELETE',
        url: `/babies/${babyId}/specialists/${specialistId}`,
        headers: { cookie, 'x-csrf-token': csrfToken },
      });

      expect(deleteResponse.statusCode).toBe(204);

      const afterDelete = await app.inject({
        method: 'GET',
        url: `/babies/${babyId}/appointments`,
        headers: { cookie, 'x-csrf-token': csrfToken },
      });

      expect(afterDelete.statusCode).toBe(200);
      const appointments = afterDelete.json();
      expect(appointments).toHaveLength(1);
      expect(appointments[0].id).toBe(appointmentId);
      expect(appointments[0].doctorName).toBe('Dra. Fernanda Lima');
      expect(appointments[0].specialistId).toBeNull();
    });

    it('answers 404 for a specialist that does not exist', async () => {
      const { cookie, csrfToken } = await registerAndLogin('parent-specialist-missing@example.com');
      const babyId = await createBaby(cookie, csrfToken);

      const response = await app.inject({
        method: 'DELETE',
        url: `/babies/${babyId}/specialists/11111111-1111-4111-8111-111111111111`,
        headers: { cookie, 'x-csrf-token': csrfToken },
      });

      expect(response.statusCode).toBe(404);
    });
  });
});
