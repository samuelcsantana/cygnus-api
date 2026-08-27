import { FastifyInstance } from 'fastify';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { buildApp } from '../../src/infrastructure/http/build-app';
import { prisma } from '../../src/infrastructure/database/prisma-client';

describe('Legal acceptance routes', () => {
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
    await prisma.legalAcceptance.deleteMany();
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

  const accept = (auth: { cookie: string; csrfToken: string }, payload: unknown) =>
    app.inject({
      method: 'POST',
      url: '/legal/acceptances',
      headers: { cookie: auth.cookie, 'x-csrf-token': auth.csrfToken },
      payload,
    });

  const list = (auth: { cookie: string }) =>
    app.inject({ method: 'GET', url: '/legal/acceptances', headers: { cookie: auth.cookie } });

  it('returns an empty list for a user who has accepted nothing', async () => {
    const auth = await registerAndLogin('legal-empty@example.com');

    const response = await list(auth);

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual([]);
  });

  it('records an acceptance and returns it in the list', async () => {
    const auth = await registerAndLogin('legal-record@example.com');

    const created = await accept(auth, { documentId: 'privacy', version: '1.0.0' });

    expect(created.statusCode).toBe(200);
    expect(created.json()).toMatchObject({ documentId: 'privacy', version: '1.0.0' });
    expect(typeof created.json().acceptedAt).toBe('string');

    const listed = await list(auth);

    expect(listed.json()).toHaveLength(1);
    expect(listed.json()[0]).toMatchObject({ documentId: 'privacy', version: '1.0.0' });
  });

  it('is idempotent, and keeps the timestamp of the first acceptance', async () => {
    // A second POST is what a double-tap or a retried request looks like. Moving the timestamp
    // forward would rewrite when consent was actually given, which is the one fact this record
    // exists to hold.
    const auth = await registerAndLogin('legal-idempotent@example.com');

    const first = await accept(auth, { documentId: 'terms', version: '1.0.0' });
    await new Promise((resolve) => setTimeout(resolve, 10));
    const second = await accept(auth, { documentId: 'terms', version: '1.0.0' });

    expect(second.statusCode).toBe(200);
    expect(second.json().acceptedAt).toBe(first.json().acceptedAt);

    const listed = await list(auth);
    expect(listed.json()).toHaveLength(1);
  });

  it('keeps each accepted version as its own record', async () => {
    // The point of versioning the acceptance: 1.0.0 having been accepted says nothing about 2.0.0,
    // and the history of which text was agreed to when has to survive the upgrade.
    const auth = await registerAndLogin('legal-versions@example.com');

    await accept(auth, { documentId: 'privacy', version: '1.0.0' });
    await accept(auth, { documentId: 'privacy', version: '2.0.0' });

    const listed = await list(auth);

    expect(listed.json()).toHaveLength(2);
    expect(listed.json().map((row: { version: string }) => row.version).sort()).toEqual(['1.0.0', '2.0.0']);
  });

  it('does not show one user the acceptances of another', async () => {
    const first = await registerAndLogin('legal-mine@example.com');
    const second = await registerAndLogin('legal-theirs@example.com');

    await accept(first, { documentId: 'privacy', version: '1.0.0' });

    expect((await list(second)).json()).toEqual([]);
  });

  it('rejects a document that is not one of the two', async () => {
    const auth = await registerAndLogin('legal-unknown-doc@example.com');

    const response = await accept(auth, { documentId: 'cookies', version: '1.0.0' });

    expect(response.statusCode).toBe(400);
  });

  it('rejects an empty version', async () => {
    const auth = await registerAndLogin('legal-empty-version@example.com');

    const response = await accept(auth, { documentId: 'privacy', version: '   ' });

    expect(response.statusCode).toBe(400);
  });

  it('requires a session on both routes', async () => {
    expect((await app.inject({ method: 'GET', url: '/legal/acceptances' })).statusCode).toBe(401);
    expect(
      (
        await app.inject({
          method: 'POST',
          url: '/legal/acceptances',
          payload: { documentId: 'privacy', version: '1.0.0' },
        })
      ).statusCode,
    ).toBe(401);
  });

  it('exposes both legal routes in the generated OpenAPI document', async () => {
    const response = await app.inject({ method: 'GET', url: '/docs/json' });
    const document = response.json();
    const path = document.paths['/legal/acceptances'];

    expect(path).toBeDefined();
    expect(path.get.tags).toContain('Legal');
    expect(path.post.tags).toContain('Legal');
    expect(path.post.responses['200']).toBeDefined();
    expect(path.post.responses['400']).toBeDefined();
    expect(path.post.responses['401']).toBeDefined();
  });
});
