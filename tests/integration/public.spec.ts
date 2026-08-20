import { FastifyInstance } from 'fastify';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { buildApp } from '../../src/infrastructure/http/build-app';
import { prisma } from '../../src/infrastructure/database/prisma-client';
import { publicVaccineScheduleResponseSchema } from '../../src/presentation/http/schemas/public.schema';

const FOREIGN_ORIGIN = 'https://www.samuelsantana.dev';

describe('GET /public/vaccine-schedule', () => {
  let app: FastifyInstance;

  beforeAll(async () => {
    app = await buildApp();
    await app.ready();
  });

  afterAll(async () => {
    await app.close();
    await prisma.$disconnect();
  });

  it('serves the PNI schedule without authentication', async () => {
    const response = await app.inject({ method: 'GET', url: '/public/vaccine-schedule' });

    expect(response.statusCode).toBe(200);

    const parsed = publicVaccineScheduleResponseSchema.safeParse(response.json());
    expect(parsed.success).toBe(true);
    expect(parsed.success && parsed.data.schedule.length).toBeGreaterThan(0);
  });

  it('orders the schedule by age, then by dose', async () => {
    const response = await app.inject({ method: 'GET', url: '/public/vaccine-schedule' });
    const { schedule } = response.json();

    for (let i = 1; i < schedule.length; i += 1) {
      const previous = schedule[i - 1];
      const current = schedule[i];
      const ordered =
        previous.recommendedAgeInMonths < current.recommendedAgeInMonths ||
        (previous.recommendedAgeInMonths === current.recommendedAgeInMonths && previous.doseNumber <= current.doseNumber);

      expect(ordered).toBe(true);
    }
  });

  it('is readable from any origin, and never with credentials', async () => {
    const response = await app.inject({
      method: 'GET',
      url: '/public/vaccine-schedule',
      headers: { origin: FOREIGN_ORIGIN },
    });

    expect(response.headers['access-control-allow-origin']).toBe('*');
    // The pairing is the safety property, not a detail: a browser refuses to send cookies to a
    // wildcard origin, so this header staying absent is what stops the open endpoint from ever
    // becoming an authenticated one.
    expect(response.headers['access-control-allow-credentials']).toBeUndefined();
  });

  it('leaves the authenticated surface on the strict, single-origin policy', async () => {
    const response = await app.inject({
      method: 'POST',
      url: '/auth/login',
      headers: { origin: FOREIGN_ORIGIN },
      payload: { email: 'nobody@example.com', password: 'irrelevant' },
    });

    // The foreign origin must not be reflected back, and must not be wildcarded — regardless of
    // whether the credentials themselves are valid.
    expect(response.headers['access-control-allow-origin']).not.toBe('*');
    expect(response.headers['access-control-allow-origin']).not.toBe(FOREIGN_ORIGIN);
  });

  it('answers a preflight from an arbitrary origin', async () => {
    const response = await app.inject({
      method: 'OPTIONS',
      url: '/public/vaccine-schedule',
      headers: {
        origin: FOREIGN_ORIGIN,
        'access-control-request-method': 'GET',
      },
    });

    expect([200, 204]).toContain(response.statusCode);
    expect(response.headers['access-control-allow-origin']).toBe('*');
  });

  it('marks the response cacheable by shared caches', async () => {
    const response = await app.inject({ method: 'GET', url: '/public/vaccine-schedule' });

    expect(response.headers['cache-control']).toContain('public');
  });
});
