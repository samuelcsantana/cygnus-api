import { FastifyInstance } from 'fastify';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { buildApp } from '../../src/infrastructure/http/build-app';
import { prisma } from '../../src/infrastructure/database/prisma-client';
import { healthySchema } from '../../src/presentation/http/schemas/health.schema';

describe('GET /health', () => {
  let app: FastifyInstance;

  beforeAll(async () => {
    app = await buildApp();
    await app.ready();
  });

  afterAll(async () => {
    await app.close();
    await prisma.$disconnect();
  });

  it('returns 200 with a healthy report matching the Swagger contract when the database is reachable', async () => {
    const response = await app.inject({ method: 'GET', url: '/health' });

    expect(response.statusCode).toBe(200);

    const body = response.json();
    const parsed = healthySchema.safeParse(body);

    expect(parsed.success).toBe(true);
    expect(body).toMatchObject({ status: 'ok', database: 'up' });
    expect(typeof body.uptimeSeconds).toBe('number');
  });

  it('exposes the /health route in the generated OpenAPI document', async () => {
    const response = await app.inject({ method: 'GET', url: '/docs/json' });

    expect(response.statusCode).toBe(200);

    const openApiDocument = response.json();
    const healthPath = openApiDocument.paths['/health'];

    expect(healthPath).toBeDefined();
    expect(healthPath.get.tags).toContain('Health');
    expect(healthPath.get.responses['200']).toBeDefined();
    expect(healthPath.get.responses['503']).toBeDefined();
  });
});
