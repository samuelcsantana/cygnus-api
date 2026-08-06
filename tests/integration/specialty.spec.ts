import { FastifyInstance } from 'fastify';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { buildApp } from '../../src/infrastructure/http/build-app';
import { prisma } from '../../src/infrastructure/database/prisma-client';
import { MEDICAL_SPECIALTIES } from '../../src/domain/appointment/medical-specialty';

describe('Specialty routes', () => {
  let app: FastifyInstance;

  beforeAll(async () => {
    app = await buildApp();
    await app.ready();
  });

  afterAll(async () => {
    await app.close();
    await prisma.$disconnect();
  });

  describe('GET /specialties', () => {
    it('returns the static list of medical specialties without requiring authentication', async () => {
      const response = await app.inject({ method: 'GET', url: '/specialties' });

      expect(response.statusCode).toBe(200);
      expect(response.json()).toEqual(MEDICAL_SPECIALTIES);
    });
  });

  it('exposes the specialties route in the generated OpenAPI document', async () => {
    const response = await app.inject({ method: 'GET', url: '/docs/json' });
    const openApiDocument = response.json();

    expect(openApiDocument.paths['/specialties'].get.tags).toContain('Appointments');
  });
});
