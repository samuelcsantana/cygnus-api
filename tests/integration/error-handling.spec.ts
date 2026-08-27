import { FastifyInstance } from 'fastify';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { buildApp } from '../../src/infrastructure/http/build-app';
import { prisma } from '../../src/infrastructure/database/prisma-client';

/**
 * The error handler in build-app.ts, exercised through the framework errors that reach it.
 *
 * These are not route behaviours — no handler runs for any of them. They are raised by Fastify
 * before dispatch, and the thing under test is that the response says whose fault it was.
 */
describe('error handling', () => {
  let app: FastifyInstance;

  beforeAll(async () => {
    app = await buildApp();

    // Registered here rather than inside the test: Fastify refuses a route added after ready().
    app.get('/__test_server_failure', async () => {
      throw new Error('boom');
    });

    await app.ready();
  });

  afterAll(async () => {
    await app.close();
    await prisma.$disconnect();
  });

  it('answers 400, not 500, when a JSON content-type arrives with no body', async () => {
    // FST_ERR_CTP_EMPTY_JSON_BODY. It used to fall through to the generic 500 branch, so a caller
    // who forgot the payload was told the server had broken, and the mistake landed in the error
    // log as an unhandled failure of ours.
    const response = await app.inject({
      method: 'POST',
      url: '/auth/login',
      headers: { 'content-type': 'application/json' },
      payload: '',
    });

    expect(response.statusCode).toBe(400);
    expect(response.json()).toMatchObject({ status: 'error' });
  });

  it('answers 400, not 500, when the body is not parseable JSON', async () => {
    const response = await app.inject({
      method: 'POST',
      url: '/auth/login',
      headers: { 'content-type': 'application/json' },
      payload: '{"email": ',
    });

    expect(response.statusCode).toBe(400);
    expect(response.json()).toMatchObject({ status: 'error' });
  });

  it('still answers 500 for a genuine server fault', async () => {
    // The branch above keys on a 4xx statusCode, so the guard that matters is that it did not
    // swallow everything: an error with no status of its own must still be a 500.
    const response = await app.inject({ method: 'GET', url: '/__test_server_failure' });

    expect(response.statusCode).toBe(500);
    expect(response.json()).toMatchObject({ status: 'error', message: 'Internal server error' });
  });
});
