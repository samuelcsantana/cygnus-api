import { FastifyInstance } from 'fastify';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { buildApp } from '../../src/infrastructure/http/build-app';
import { prisma } from '../../src/infrastructure/database/prisma-client';
import { VACCINE_CATALOG_SEED } from '../../prisma/vaccine-catalog-seed-data';

describe('Vaccine routes', () => {
  let app: FastifyInstance;

  beforeAll(async () => {
    app = await buildApp();
    await app.ready();

    for (const vaccine of VACCINE_CATALOG_SEED) {
      await prisma.vaccine.upsert({
        where: { name_doseNumber: { name: vaccine.name, doseNumber: vaccine.doseNumber } },
        update: {},
        create: vaccine,
      });
    }
  });

  afterAll(async () => {
    await app.close();
    await prisma.$disconnect();
  });

  beforeEach(async () => {
    await prisma.babyVaccineRecord.deleteMany();
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

  async function createBaby(cookie: string, birthDate: string): Promise<string> {
    const response = await app.inject({
      method: 'POST',
      url: '/babies',
      headers: { cookie },
      payload: { name: 'Baby', birthDate, gender: 'FEMALE' },
    });

    return response.json().id;
  }

  describe('GET /babies/:babyId/vaccines', () => {
    it('returns the schedule grouped by age, marking overdue doses as DELAYED', async () => {
      const cookie = await registerAndLogin('parent-schedule@example.com');
      const oldBirthDate = new Date();
      oldBirthDate.setUTCMonth(oldBirthDate.getUTCMonth() - 6);
      const babyId = await createBaby(cookie, oldBirthDate.toISOString().slice(0, 10));

      const response = await app.inject({
        method: 'GET',
        url: `/babies/${babyId}/vaccines`,
        headers: { cookie },
      });

      expect(response.statusCode).toBe(200);

      const schedule = response.json();
      expect(Array.isArray(schedule)).toBe(true);
      expect(schedule.map((group: { ageInMonths: number }) => group.ageInMonths)).toEqual([0, 2]);

      const allItems = schedule.flatMap((group: { items: unknown[] }) => group.items);
      expect(allItems).toHaveLength(VACCINE_CATALOG_SEED.length);
      expect(allItems.every((item: { status: string }) => item.status === 'DELAYED')).toBe(true);
    });

    it('returns PENDING for a newborn whose doses are not due yet', async () => {
      const cookie = await registerAndLogin('parent-newborn@example.com');
      const today = new Date().toISOString().slice(0, 10);
      const babyId = await createBaby(cookie, today);

      const response = await app.inject({
        method: 'GET',
        url: `/babies/${babyId}/vaccines`,
        headers: { cookie },
      });

      const schedule = response.json();
      const birthDoseGroup = schedule.find((group: { ageInMonths: number }) => group.ageInMonths === 0);
      const twoMonthGroup = schedule.find((group: { ageInMonths: number }) => group.ageInMonths === 2);

      expect(birthDoseGroup.items.every((item: { status: string }) => item.status === 'PENDING')).toBe(true);
      expect(twoMonthGroup.items.every((item: { status: string }) => item.status === 'PENDING')).toBe(true);
    });

    it("prevents a user from reading another user's baby vaccine schedule", async () => {
      const ownerCookie = await registerAndLogin('vaccine-owner@example.com');
      const intruderCookie = await registerAndLogin('vaccine-intruder@example.com');
      const babyId = await createBaby(ownerCookie, '2024-01-01');

      const response = await app.inject({
        method: 'GET',
        url: `/babies/${babyId}/vaccines`,
        headers: { cookie: intruderCookie },
      });

      expect(response.statusCode).toBe(404);
    });
  });

  describe('PATCH /babies/:babyId/vaccines/:vaccineId/apply', () => {
    it('marks a vaccine as applied and reflects it in the schedule', async () => {
      const cookie = await registerAndLogin('parent-apply@example.com');
      const babyId = await createBaby(cookie, '2024-01-01');
      const vaccine = await prisma.vaccine.findFirstOrThrow({ where: { recommendedAgeInMonths: 0 } });

      const applyResponse = await app.inject({
        method: 'PATCH',
        url: `/babies/${babyId}/vaccines/${vaccine.id}/apply`,
        headers: { cookie },
        payload: { applicationDate: '2024-01-05', notes: 'Applied at the maternity ward' },
      });

      expect(applyResponse.statusCode).toBe(200);
      expect(applyResponse.json()).toMatchObject({
        vaccineId: vaccine.id,
        status: 'APPLIED',
        applicationDate: '2024-01-05',
        notes: 'Applied at the maternity ward',
      });

      const scheduleResponse = await app.inject({
        method: 'GET',
        url: `/babies/${babyId}/vaccines`,
        headers: { cookie },
      });

      const schedule = scheduleResponse.json();
      const item = schedule
        .flatMap((group: { items: { vaccineId: string }[] }) => group.items)
        .find((scheduleItem: { vaccineId: string }) => scheduleItem.vaccineId === vaccine.id);

      expect(item.status).toBe('APPLIED');
    });

    it('returns 404 when marking a baby that belongs to another user', async () => {
      const ownerCookie = await registerAndLogin('apply-owner@example.com');
      const intruderCookie = await registerAndLogin('apply-intruder@example.com');
      const babyId = await createBaby(ownerCookie, '2024-01-01');
      const vaccine = await prisma.vaccine.findFirstOrThrow({ where: { recommendedAgeInMonths: 0 } });

      const response = await app.inject({
        method: 'PATCH',
        url: `/babies/${babyId}/vaccines/${vaccine.id}/apply`,
        headers: { cookie: intruderCookie },
        payload: {},
      });

      expect(response.statusCode).toBe(404);
    });

    it('returns 404 for a vaccine id that does not exist in the catalog', async () => {
      const cookie = await registerAndLogin('parent-unknown-vaccine@example.com');
      const babyId = await createBaby(cookie, '2024-01-01');

      const response = await app.inject({
        method: 'PATCH',
        url: `/babies/${babyId}/vaccines/00000000-0000-0000-0000-000000000000/apply`,
        headers: { cookie },
        payload: {},
      });

      expect(response.statusCode).toBe(404);
    });
  });

  it('exposes all vaccine routes in the generated OpenAPI document', async () => {
    const response = await app.inject({ method: 'GET', url: '/docs/json' });
    const openApiDocument = response.json();

    expect(openApiDocument.paths['/babies/{babyId}/vaccines'].get.tags).toContain('Vaccines');
    expect(openApiDocument.paths['/babies/{babyId}/vaccines/{vaccineId}/apply'].patch.tags).toContain('Vaccines');
  });
});
