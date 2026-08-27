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

  function futureIsoString(daysFromNow: number): string {
    return new Date(Date.now() + daysFromNow * 24 * 60 * 60 * 1000).toISOString();
  }

  describe('POST /babies/:babyId/appointments', () => {
    it('schedules a new appointment', async () => {
      const { cookie, csrfToken } = await registerAndLogin('parent-schedule@example.com');
      const babyId = await createBaby(cookie, csrfToken);

      const response = await app.inject({
        method: 'POST',
        url: `/babies/${babyId}/appointments`,
        headers: { cookie, 'x-csrf-token': csrfToken },
        payload: {
          scheduledAt: futureIsoString(7),
          doctorName: 'Dr. Ana Souza',
          location: 'Clínica Cygnus',
          reason: 'Routine check-up',
        },
      });

      expect(response.statusCode).toBe(201);
      const body = response.json();
      expect(body).toMatchObject({
        babyId,
        doctorName: 'Dr. Ana Souza',
        location: 'Clínica Cygnus',
        reason: 'Routine check-up',
        status: 'SCHEDULED',
        notes: null,
      });
    });

    it('rejects scheduling an appointment in the past', async () => {
      const { cookie, csrfToken } = await registerAndLogin('parent-past@example.com');
      const babyId = await createBaby(cookie, csrfToken);

      const response = await app.inject({
        method: 'POST',
        url: `/babies/${babyId}/appointments`,
        headers: { cookie, 'x-csrf-token': csrfToken },
        payload: { scheduledAt: '2020-01-01T10:00:00.000Z', doctorName: 'Dr. Ana Souza' },
      });

      expect(response.statusCode).toBe(400);
    });

    it('records a consultation that already happened, as COMPLETED', async () => {
      // The past date above is still rejected — for a booking. Saying the visit already happened
      // is what makes a past date the correct input rather than a mistake.
      const { cookie, csrfToken } = await registerAndLogin('parent-record-past@example.com');
      const babyId = await createBaby(cookie, csrfToken);

      const response = await app.inject({
        method: 'POST',
        url: `/babies/${babyId}/appointments`,
        headers: { cookie, 'x-csrf-token': csrfToken },
        payload: {
          scheduledAt: '2020-01-01T10:00:00.000Z',
          doctorName: 'Dr. Ana Souza',
          specialty: 'Pediatria',
          status: 'COMPLETED',
        },
      });

      expect(response.statusCode).toBe(201);
      expect(response.json()).toMatchObject({ status: 'COMPLETED', specialty: 'Pediatria' });
    });

    it('rejects recording a consultation dated in the future', async () => {
      const { cookie, csrfToken } = await registerAndLogin('parent-record-future@example.com');
      const babyId = await createBaby(cookie, csrfToken);

      const response = await app.inject({
        method: 'POST',
        url: `/babies/${babyId}/appointments`,
        headers: { cookie, 'x-csrf-token': csrfToken },
        payload: {
          scheduledAt: '2099-01-01T10:00:00.000Z',
          doctorName: 'Dr. Ana Souza',
          status: 'COMPLETED',
        },
      });

      expect(response.statusCode).toBe(400);
    });

    it("rejects scheduling for another user's baby", async () => {
      const { cookie: ownerCookie, csrfToken: ownerCsrfToken } = await registerAndLogin('appt-owner@example.com');
      const { cookie: intruderCookie, csrfToken: intruderCsrfToken } = await registerAndLogin('appt-intruder@example.com');
      const babyId = await createBaby(ownerCookie, ownerCsrfToken);

      const response = await app.inject({
        method: 'POST',
        url: `/babies/${babyId}/appointments`,
        headers: { cookie: intruderCookie, 'x-csrf-token': intruderCsrfToken },
        payload: { scheduledAt: futureIsoString(7), doctorName: 'Dr. Ana Souza' },
      });

      expect(response.statusCode).toBe(404);
    });
  });

  describe('GET /babies/:babyId/appointments', () => {
    it("lists only the baby's own appointments, ordered by scheduled date", async () => {
      const { cookie, csrfToken } = await registerAndLogin('parent-list@example.com');
      const babyId = await createBaby(cookie, csrfToken);

      await app.inject({
        method: 'POST',
        url: `/babies/${babyId}/appointments`,
        headers: { cookie, 'x-csrf-token': csrfToken },
        payload: { scheduledAt: futureIsoString(14), doctorName: 'Dr. Second Visit' },
      });
      await app.inject({
        method: 'POST',
        url: `/babies/${babyId}/appointments`,
        headers: { cookie, 'x-csrf-token': csrfToken },
        payload: { scheduledAt: futureIsoString(7), doctorName: 'Dr. First Visit' },
      });

      const response = await app.inject({ method: 'GET', url: `/babies/${babyId}/appointments`, headers: { cookie, 'x-csrf-token': csrfToken } });

      expect(response.statusCode).toBe(200);
      const appointments = response.json();
      expect(appointments).toHaveLength(2);
      expect(appointments[0].doctorName).toBe('Dr. First Visit');
      expect(appointments[1].doctorName).toBe('Dr. Second Visit');
    });

    it('filters by search across doctorName, specialty, location and reason, case-insensitively', async () => {
      const { cookie, csrfToken } = await registerAndLogin('parent-search-appointments@example.com');
      const babyId = await createBaby(cookie, csrfToken);

      await app.inject({
        method: 'POST',
        url: `/babies/${babyId}/appointments`,
        headers: { cookie, 'x-csrf-token': csrfToken },
        payload: { scheduledAt: futureIsoString(7), doctorName: 'Dr. Ana Souza', specialty: 'Pediatria' },
      });
      await app.inject({
        method: 'POST',
        url: `/babies/${babyId}/appointments`,
        headers: { cookie, 'x-csrf-token': csrfToken },
        payload: { scheduledAt: futureIsoString(14), doctorName: 'Dr. Carlos Lima', location: 'Clínica Vida' },
      });

      const byDoctorName = await app.inject({
        method: 'GET',
        url: `/babies/${babyId}/appointments?search=ana souza`,
        headers: { cookie, 'x-csrf-token': csrfToken },
      });
      expect(byDoctorName.statusCode).toBe(200);
      expect(byDoctorName.json()).toHaveLength(1);
      expect(byDoctorName.json()[0].doctorName).toBe('Dr. Ana Souza');

      const byLocation = await app.inject({
        method: 'GET',
        url: `/babies/${babyId}/appointments?search=vida`,
        headers: { cookie, 'x-csrf-token': csrfToken },
      });
      expect(byLocation.statusCode).toBe(200);
      expect(byLocation.json()).toHaveLength(1);
      expect(byLocation.json()[0].doctorName).toBe('Dr. Carlos Lima');

      const noMatch = await app.inject({
        method: 'GET',
        url: `/babies/${babyId}/appointments?search=nonexistent`,
        headers: { cookie, 'x-csrf-token': csrfToken },
      });
      expect(noMatch.statusCode).toBe(200);
      expect(noMatch.json()).toHaveLength(0);
    });

    it('returns every appointment when search is omitted', async () => {
      const { cookie, csrfToken } = await registerAndLogin('parent-no-search-appointments@example.com');
      const babyId = await createBaby(cookie, csrfToken);

      await app.inject({
        method: 'POST',
        url: `/babies/${babyId}/appointments`,
        headers: { cookie, 'x-csrf-token': csrfToken },
        payload: { scheduledAt: futureIsoString(7), doctorName: 'Dr. Ana Souza' },
      });
      await app.inject({
        method: 'POST',
        url: `/babies/${babyId}/appointments`,
        headers: { cookie, 'x-csrf-token': csrfToken },
        payload: { scheduledAt: futureIsoString(14), doctorName: 'Dr. Carlos Lima' },
      });

      const response = await app.inject({
        method: 'GET',
        url: `/babies/${babyId}/appointments`,
        headers: { cookie, 'x-csrf-token': csrfToken },
      });

      expect(response.statusCode).toBe(200);
      expect(response.json()).toHaveLength(2);
    });
  });

  describe('PATCH /babies/:babyId/appointments/:appointmentId', () => {
    it('marks an appointment as completed and adds notes, even after its scheduled time has passed', async () => {
      const { cookie, csrfToken } = await registerAndLogin('parent-complete@example.com');
      const babyId = await createBaby(cookie, csrfToken);

      const createResponse = await app.inject({
        method: 'POST',
        url: `/babies/${babyId}/appointments`,
        headers: { cookie, 'x-csrf-token': csrfToken },
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
        headers: { cookie, 'x-csrf-token': csrfToken },
        payload: { status: 'COMPLETED', notes: 'Baby is healthy' },
      });

      expect(response.statusCode).toBe(200);
      const body = response.json();
      expect(body.status).toBe('COMPLETED');
      expect(body.notes).toBe('Baby is healthy');
    });

    it('rejects rescheduling to a past date', async () => {
      const { cookie, csrfToken } = await registerAndLogin('parent-reschedule@example.com');
      const babyId = await createBaby(cookie, csrfToken);

      const createResponse = await app.inject({
        method: 'POST',
        url: `/babies/${babyId}/appointments`,
        headers: { cookie, 'x-csrf-token': csrfToken },
        payload: { scheduledAt: futureIsoString(7), doctorName: 'Dr. Ana Souza' },
      });
      const appointmentId = createResponse.json().id;

      const response = await app.inject({
        method: 'PATCH',
        url: `/babies/${babyId}/appointments/${appointmentId}`,
        headers: { cookie, 'x-csrf-token': csrfToken },
        payload: { scheduledAt: '2020-01-01T10:00:00.000Z' },
      });

      expect(response.statusCode).toBe(400);
    });

    it('returns 404 when updating an appointment that belongs to another user', async () => {
      const { cookie: ownerCookie, csrfToken: ownerCsrfToken } = await registerAndLogin('appt-update-owner@example.com');
      const { cookie: intruderCookie, csrfToken: intruderCsrfToken } = await registerAndLogin('appt-update-intruder@example.com');
      const babyId = await createBaby(ownerCookie, ownerCsrfToken);

      const createResponse = await app.inject({
        method: 'POST',
        url: `/babies/${babyId}/appointments`,
        headers: { cookie: ownerCookie, 'x-csrf-token': ownerCsrfToken },
        payload: { scheduledAt: futureIsoString(7), doctorName: 'Dr. Ana Souza' },
      });
      const appointmentId = createResponse.json().id;

      const response = await app.inject({
        method: 'PATCH',
        url: `/babies/${babyId}/appointments/${appointmentId}`,
        headers: { cookie: intruderCookie, 'x-csrf-token': intruderCsrfToken },
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
