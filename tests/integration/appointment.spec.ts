import { FastifyInstance } from 'fastify';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { buildApp } from '../../src/infrastructure/http/build-app';
import { prisma } from '../../src/infrastructure/database/prisma-client';

describe('Appointment routes', () => {
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
    await prisma.baby.deleteMany();
    await prisma.user.deleteMany();
  });

  function extractCookieHeader(setCookieHeader: string | string[] | undefined): string {
    const values = Array.isArray(setCookieHeader) ? setCookieHeader : setCookieHeader ? [setCookieHeader] : [];
    return values.map((cookie) => cookie.split(';')[0]).join('; ');
  }

  async function registerAndLogin(email: string): Promise<string> {
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

    return extractCookieHeader(loginResponse.headers['set-cookie']);
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

  function futureIsoString(daysFromNow: number): string {
    return new Date(Date.now() + daysFromNow * 24 * 60 * 60 * 1000).toISOString();
  }

  describe('POST /babies/:babyId/appointments', () => {
    it('schedules a new appointment', async () => {
      const cookie = await registerAndLogin('parent-schedule@example.com');
      const babyId = await createBaby(cookie);

      const response = await app.inject({
        method: 'POST',
        url: `/babies/${babyId}/appointments`,
        headers: { cookie },
        payload: {
          scheduledAt: futureIsoString(7),
          doctorName: 'Dr. Ana Souza',
          location: 'Clínica Meu Neném',
          reason: 'Routine check-up',
        },
      });

      expect(response.statusCode).toBe(201);
      const body = response.json();
      expect(body).toMatchObject({
        babyId,
        doctorName: 'Dr. Ana Souza',
        location: 'Clínica Meu Neném',
        reason: 'Routine check-up',
        status: 'SCHEDULED',
        notes: null,
      });
    });

    it('rejects scheduling an appointment in the past', async () => {
      const cookie = await registerAndLogin('parent-past@example.com');
      const babyId = await createBaby(cookie);

      const response = await app.inject({
        method: 'POST',
        url: `/babies/${babyId}/appointments`,
        headers: { cookie },
        payload: { scheduledAt: '2020-01-01T10:00:00.000Z', doctorName: 'Dr. Ana Souza' },
      });

      expect(response.statusCode).toBe(400);
    });

    it("rejects scheduling for another user's baby", async () => {
      const ownerCookie = await registerAndLogin('appt-owner@example.com');
      const intruderCookie = await registerAndLogin('appt-intruder@example.com');
      const babyId = await createBaby(ownerCookie);

      const response = await app.inject({
        method: 'POST',
        url: `/babies/${babyId}/appointments`,
        headers: { cookie: intruderCookie },
        payload: { scheduledAt: futureIsoString(7), doctorName: 'Dr. Ana Souza' },
      });

      expect(response.statusCode).toBe(404);
    });
  });

  describe('GET /babies/:babyId/appointments', () => {
    it("lists only the baby's own appointments, ordered by scheduled date", async () => {
      const cookie = await registerAndLogin('parent-list@example.com');
      const babyId = await createBaby(cookie);

      await app.inject({
        method: 'POST',
        url: `/babies/${babyId}/appointments`,
        headers: { cookie },
        payload: { scheduledAt: futureIsoString(14), doctorName: 'Dr. Second Visit' },
      });
      await app.inject({
        method: 'POST',
        url: `/babies/${babyId}/appointments`,
        headers: { cookie },
        payload: { scheduledAt: futureIsoString(7), doctorName: 'Dr. First Visit' },
      });

      const response = await app.inject({ method: 'GET', url: `/babies/${babyId}/appointments`, headers: { cookie } });

      expect(response.statusCode).toBe(200);
      const appointments = response.json();
      expect(appointments).toHaveLength(2);
      expect(appointments[0].doctorName).toBe('Dr. First Visit');
      expect(appointments[1].doctorName).toBe('Dr. Second Visit');
    });
  });

  describe('PATCH /babies/:babyId/appointments/:appointmentId', () => {
    it('marks an appointment as completed and adds notes, even after its scheduled time has passed', async () => {
      const cookie = await registerAndLogin('parent-complete@example.com');
      const babyId = await createBaby(cookie);

      const createResponse = await app.inject({
        method: 'POST',
        url: `/babies/${babyId}/appointments`,
        headers: { cookie },
        payload: { scheduledAt: futureIsoString(1), doctorName: 'Dr. Ana Souza' },
      });
      const appointmentId = createResponse.json().id;

      // Force the persisted appointment into the past to simulate time having passed since it was scheduled.
      await prisma.appointment.update({
        where: { id: appointmentId },
        data: { scheduledAt: new Date('2020-01-01T10:00:00.000Z') },
      });

      const response = await app.inject({
        method: 'PATCH',
        url: `/babies/${babyId}/appointments/${appointmentId}`,
        headers: { cookie },
        payload: { status: 'COMPLETED', notes: 'Baby is healthy' },
      });

      expect(response.statusCode).toBe(200);
      const body = response.json();
      expect(body.status).toBe('COMPLETED');
      expect(body.notes).toBe('Baby is healthy');
    });

    it('rejects rescheduling to a past date', async () => {
      const cookie = await registerAndLogin('parent-reschedule@example.com');
      const babyId = await createBaby(cookie);

      const createResponse = await app.inject({
        method: 'POST',
        url: `/babies/${babyId}/appointments`,
        headers: { cookie },
        payload: { scheduledAt: futureIsoString(7), doctorName: 'Dr. Ana Souza' },
      });
      const appointmentId = createResponse.json().id;

      const response = await app.inject({
        method: 'PATCH',
        url: `/babies/${babyId}/appointments/${appointmentId}`,
        headers: { cookie },
        payload: { scheduledAt: '2020-01-01T10:00:00.000Z' },
      });

      expect(response.statusCode).toBe(400);
    });

    it('returns 404 when updating an appointment that belongs to another user', async () => {
      const ownerCookie = await registerAndLogin('appt-update-owner@example.com');
      const intruderCookie = await registerAndLogin('appt-update-intruder@example.com');
      const babyId = await createBaby(ownerCookie);

      const createResponse = await app.inject({
        method: 'POST',
        url: `/babies/${babyId}/appointments`,
        headers: { cookie: ownerCookie },
        payload: { scheduledAt: futureIsoString(7), doctorName: 'Dr. Ana Souza' },
      });
      const appointmentId = createResponse.json().id;

      const response = await app.inject({
        method: 'PATCH',
        url: `/babies/${babyId}/appointments/${appointmentId}`,
        headers: { cookie: intruderCookie },
        payload: { status: 'CANCELLED' },
      });

      expect(response.statusCode).toBe(404);
    });
  });

  it('exposes all appointment routes in the generated OpenAPI document', async () => {
    const response = await app.inject({ method: 'GET', url: '/docs/json' });
    const openApiDocument = response.json();

    expect(openApiDocument.paths['/babies/{babyId}/appointments'].post.tags).toContain('Appointments');
    expect(openApiDocument.paths['/babies/{babyId}/appointments'].get.tags).toContain('Appointments');
    expect(openApiDocument.paths['/babies/{babyId}/appointments/{appointmentId}'].get.tags).toContain('Appointments');
    expect(openApiDocument.paths['/babies/{babyId}/appointments/{appointmentId}'].patch.tags).toContain(
      'Appointments',
    );
  });
});
