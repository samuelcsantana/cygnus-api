import { FastifyInstance } from 'fastify';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { buildApp } from '../../src/infrastructure/http/build-app';
import { prisma } from '../../src/infrastructure/database/prisma-client';

// Proves the security-critical property the whole guardian refactor exists to preserve: a user who
// is NOT a guardian of a baby gets 404 (never the baby's data) on its vaccines/appointments/
// milestones — the same OWASP BOLA mitigation the old `baby.userId !== requestingUserId` check had,
// now re-implemented through `ensureBabyAccess`/`BabyGuardianRepository`. It also proves the mirror
// case: a user who redeemed an invite (and is therefore a real GUARDIAN) CAN read that same data —
// so this isn't just "deny everyone", the sharing feature actually works end-to-end.
describe('Guardian-based access control (IDOR prevention)', () => {
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
    await prisma.babyInvite.deleteMany();
    await prisma.milestone.deleteMany();
    await prisma.appointment.deleteMany();
    await prisma.babyVaccineRecord.deleteMany();
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

  async function addAsGuardian(
    ownerCookie: string,
    ownerCsrfToken: string,
    babyId: string,
    guardianCookie: string,
    guardianCsrfToken: string,
  ): Promise<void> {
    const inviteResponse = await app.inject({
      method: 'POST',
      url: `/babies/${babyId}/invites`,
      headers: { cookie: ownerCookie, 'x-csrf-token': ownerCsrfToken },
      payload: {},
    });
    const { code } = inviteResponse.json();

    await app.inject({
      method: 'POST',
      url: `/invites/${code}/redeem`,
      headers: { cookie: guardianCookie, 'x-csrf-token': guardianCsrfToken },
    });
  }

  describe('a non-guardian user', () => {
    it("gets 404 on another user's baby vaccines, never the vaccine schedule", async () => {
      const { cookie: ownerCookie, csrfToken: ownerCsrfToken } = await registerAndLogin('idor-vaccine-owner@example.com');
      const { cookie: intruderCookie, csrfToken: intruderCsrfToken } = await registerAndLogin(
        'idor-vaccine-intruder@example.com',
      );
      const babyId = await createBaby(ownerCookie, ownerCsrfToken);

      const response = await app.inject({
        method: 'GET',
        url: `/babies/${babyId}/vaccines`,
        headers: { cookie: intruderCookie, 'x-csrf-token': intruderCsrfToken },
      });

      expect(response.statusCode).toBe(404);
      expect(response.json()).not.toHaveProperty('ageInMonths');
    });

    it("gets 404 on another user's baby appointments, never the appointment list", async () => {
      const { cookie: ownerCookie, csrfToken: ownerCsrfToken } = await registerAndLogin(
        'idor-appointment-owner@example.com',
      );
      const { cookie: intruderCookie, csrfToken: intruderCsrfToken } = await registerAndLogin(
        'idor-appointment-intruder@example.com',
      );
      const babyId = await createBaby(ownerCookie, ownerCsrfToken);

      await app.inject({
        method: 'POST',
        url: `/babies/${babyId}/appointments`,
        headers: { cookie: ownerCookie, 'x-csrf-token': ownerCsrfToken },
        payload: {
          scheduledAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
          doctorName: 'Dr. Ana Souza',
        },
      });

      const listResponse = await app.inject({
        method: 'GET',
        url: `/babies/${babyId}/appointments`,
        headers: { cookie: intruderCookie, 'x-csrf-token': intruderCsrfToken },
      });

      expect(listResponse.statusCode).toBe(404);
      expect(listResponse.json()).not.toEqual(expect.arrayContaining([expect.objectContaining({ doctorName: 'Dr. Ana Souza' })]));
    });

    it("gets 404 on another user's baby milestones, never the milestone list", async () => {
      const { cookie: ownerCookie, csrfToken: ownerCsrfToken } = await registerAndLogin('idor-milestone-owner@example.com');
      const { cookie: intruderCookie, csrfToken: intruderCsrfToken } = await registerAndLogin(
        'idor-milestone-intruder@example.com',
      );
      const babyId = await createBaby(ownerCookie, ownerCsrfToken);

      await app.inject({
        method: 'POST',
        url: `/babies/${babyId}/milestones`,
        headers: { cookie: ownerCookie, 'x-csrf-token': ownerCsrfToken },
        payload: { title: 'Primeiro sorriso', achievedAt: '2024-03-01', category: 'SOCIAL' },
      });

      const listResponse = await app.inject({
        method: 'GET',
        url: `/babies/${babyId}/milestones`,
        headers: { cookie: intruderCookie, 'x-csrf-token': intruderCsrfToken },
      });

      expect(listResponse.statusCode).toBe(404);
      expect(listResponse.json()).not.toEqual(
        expect.arrayContaining([expect.objectContaining({ title: 'Primeiro sorriso' })]),
      );
    });

    it("also gets 404 trying to write another user's baby milestones/appointments/vaccines", async () => {
      const { cookie: ownerCookie, csrfToken: ownerCsrfToken } = await registerAndLogin('idor-write-owner@example.com');
      const { cookie: intruderCookie, csrfToken: intruderCsrfToken } = await registerAndLogin(
        'idor-write-intruder@example.com',
      );
      const babyId = await createBaby(ownerCookie, ownerCsrfToken);

      const milestoneResponse = await app.inject({
        method: 'POST',
        url: `/babies/${babyId}/milestones`,
        headers: { cookie: intruderCookie, 'x-csrf-token': intruderCsrfToken },
        payload: { title: 'Hacked milestone', achievedAt: '2024-03-01', category: 'SOCIAL' },
      });
      expect(milestoneResponse.statusCode).toBe(404);

      const appointmentResponse = await app.inject({
        method: 'POST',
        url: `/babies/${babyId}/appointments`,
        headers: { cookie: intruderCookie, 'x-csrf-token': intruderCsrfToken },
        payload: {
          scheduledAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
          doctorName: 'Hacked Doctor',
        },
      });
      expect(appointmentResponse.statusCode).toBe(404);

      expect(await prisma.milestone.count({ where: { babyId } })).toBe(0);
      expect(await prisma.appointment.count({ where: { babyId } })).toBe(0);
    });
  });

  describe('a redeemed guardian (shared access)', () => {
    it('CAN read the vaccines, appointments and milestones of a baby shared with them via invite', async () => {
      const { cookie: ownerCookie, csrfToken: ownerCsrfToken } = await registerAndLogin('shared-owner@example.com');
      const { cookie: guardianCookie, csrfToken: guardianCsrfToken } = await registerAndLogin(
        'shared-guardian@example.com',
      );
      const babyId = await createBaby(ownerCookie, ownerCsrfToken);
      await addAsGuardian(ownerCookie, ownerCsrfToken, babyId, guardianCookie, guardianCsrfToken);

      await app.inject({
        method: 'POST',
        url: `/babies/${babyId}/milestones`,
        headers: { cookie: ownerCookie, 'x-csrf-token': ownerCsrfToken },
        payload: { title: 'Primeiro sorriso', achievedAt: '2024-03-01', category: 'SOCIAL' },
      });

      const vaccinesResponse = await app.inject({
        method: 'GET',
        url: `/babies/${babyId}/vaccines`,
        headers: { cookie: guardianCookie, 'x-csrf-token': guardianCsrfToken },
      });
      expect(vaccinesResponse.statusCode).toBe(200);

      const appointmentsResponse = await app.inject({
        method: 'GET',
        url: `/babies/${babyId}/appointments`,
        headers: { cookie: guardianCookie, 'x-csrf-token': guardianCsrfToken },
      });
      expect(appointmentsResponse.statusCode).toBe(200);

      const milestonesResponse = await app.inject({
        method: 'GET',
        url: `/babies/${babyId}/milestones`,
        headers: { cookie: guardianCookie, 'x-csrf-token': guardianCsrfToken },
      });
      expect(milestonesResponse.statusCode).toBe(200);
      expect(milestonesResponse.json()).toEqual(
        expect.arrayContaining([expect.objectContaining({ title: 'Primeiro sorriso' })]),
      );
    });
  });
});
