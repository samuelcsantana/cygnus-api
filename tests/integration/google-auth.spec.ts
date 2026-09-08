import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { LoginTicket, OAuth2Client } from 'google-auth-library';
import type { FastifyInstance } from 'fastify';
import { createHash } from 'node:crypto';
import { redis } from '../../src/infrastructure/cache/redis-client';
import { buildApp } from '../../src/infrastructure/http/build-app';
import { prisma } from '../../src/infrastructure/database/prisma-client';
import { env } from '../../src/shared/config/env';

describe('Google sign-in', () => {
  let app: FastifyInstance;
  const original = { GOOGLE_CLIENT_ID: env.GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET: env.GOOGLE_CLIENT_SECRET, GOOGLE_REDIRECT_URI: env.GOOGLE_REDIRECT_URI };
  const subject = 'google-subject-123';
  beforeAll(async () => { app = await buildApp(); await app.ready(); });
  beforeEach(async () => {
    Object.assign(env, { GOOGLE_CLIENT_ID: 'test-client', GOOGLE_CLIENT_SECRET: 'test-secret', GOOGLE_REDIRECT_URI: 'http://localhost:3005/auth/google/callback' });
    await prisma.user.deleteMany();
  });
  afterEach(() => { vi.restoreAllMocks(); Object.assign(env, original); });
  afterAll(async () => { await app.close(); await prisma.$disconnect(); });

  async function begin() {
    const response = await app.inject({ method: 'POST', url: '/auth/google/start', headers: { origin: env.CORS_ORIGIN } });
    expect(response.statusCode).toBe(200);
    const url = new URL(response.json().url);
    const cookie = response.cookies.find(c => c.name === 'google_oauth')!;
    expect(cookie.httpOnly).toBe(true);
    expect(cookie.sameSite).toBe('Lax');
    expect(url.searchParams.get('code_challenge_method')).toBe('S256');
    expect(url.searchParams.get('scope')).toBe('openid email profile');
    return { url, cookie: { google_oauth: cookie.value } };
  }
  function mockGoogle(nonce: string, overrides = {}) {
    const exchange = vi.spyOn(OAuth2Client.prototype, 'getToken').mockResolvedValue({ tokens: { id_token: 'test-id-token' } } as never);
    const verify = vi.spyOn(OAuth2Client.prototype, 'verifyIdToken').mockResolvedValue(new LoginTicket(undefined, {
      iss: 'https://accounts.google.com', aud: 'test-client', sub: subject, iat: 1, exp: 9999999999,
      email: 'parent@gmail.com', email_verified: true, name: 'Google Parent', nonce, ...overrides,
    }));
    return { exchange, verify };
  }
  async function finish(flow: Awaited<ReturnType<typeof begin>>, overrides = {}) {
    return app.inject({ method: 'GET', url: `/auth/google/callback?state=${flow.url.searchParams.get('state')}&code=single-use-code`, cookies: flow.cookie, ...overrides });
  }

  it('reports availability and refuses starts when credentials are absent', async () => {
    env.GOOGLE_CLIENT_ID = undefined;
    expect((await app.inject('/auth/google/status')).json()).toEqual({ enabled: false });
    expect((await app.inject({ method: 'POST', url: '/auth/google/start', headers: { origin: env.CORS_ORIGIN } })).statusCode).toBe(503);
  });
  it('rejects starts from another origin or without Origin', async () => {
    for (const headers of [{ origin: 'https://attacker.example' }, {}]) {
      expect((await app.inject({ method: 'POST', url: '/auth/google/start', headers })).statusCode).toBe(403);
    }
  });
  it('creates a user, binds the subject and issues the regular session cookies', async () => {
    const flow = await begin();
    const { exchange, verify } = mockGoogle(flow.url.searchParams.get('nonce')!);
    const response = await finish(flow);
    expect(response.statusCode).toBe(302);
    expect(response.headers.location).toBe(new URL('/auth/google/complete', env.CORS_ORIGIN).toString());
    expect(exchange).toHaveBeenCalledWith(expect.objectContaining({ codeVerifier: expect.any(String) }));
    expect(verify).toHaveBeenCalledWith({ idToken: 'test-id-token', audience: 'test-client' });
    expect(response.cookies.find(c => c.name === 'access_token')?.sameSite).toBe('Strict');
    const cookieHeader = response.cookies.map(c => `${c.name}=${c.value}`).join('; ');
    const me = await app.inject({ url: '/auth/me', headers: { cookie: cookieHeader } });
    expect(me.json()).toMatchObject({ name: 'Google Parent', email: 'parent@gmail.com' });
    expect(await prisma.googleIdentity.count()).toBe(1);
    expect((await finish(flow)).headers.location).toContain('error=failed');
    expect(exchange).toHaveBeenCalledTimes(1);
  });
  it('does not consume a transaction copied into another browser', async () => {
    const flow = await begin();
    const { exchange } = mockGoogle(flow.url.searchParams.get('nonce')!);
    expect((await finish(flow, { cookies: {} })).headers.location).toContain('error=failed');
    expect(exchange).not.toHaveBeenCalled();
    expect((await finish(flow, { cookies: { google_oauth: 'x'.repeat(43) } })).headers.location).toContain('error=failed');
    expect((await finish(flow)).headers.location).not.toContain('error=');
  });
  it('rejects an expired transaction before contacting Google', async () => {
    const flow = await begin();
    const { exchange } = mockGoogle(flow.url.searchParams.get('nonce')!);
    const key = `google-oauth:${createHash('sha256').update(`${flow.url.searchParams.get('state')}:${flow.cookie.google_oauth}`).digest('hex')}`;
    expect(await redis.ttl(key)).toBeGreaterThan(0);
    expect(await redis.ttl(key)).toBeLessThanOrEqual(600);
    await redis.expire(key, 0);
    expect((await finish(flow)).headers.location).toContain('error=failed');
    expect(exchange).not.toHaveBeenCalled();
  });
  it('rejects unknown state and cancelled consent without a session', async () => {
    const flow = await begin();
    const { exchange } = mockGoogle(flow.url.searchParams.get('nonce')!);
    const cancelled = await app.inject({ url: `/auth/google/callback?state=${flow.url.searchParams.get('state')}&error=access_denied`, cookies: flow.cookie });
    expect(cancelled.headers.location).toContain('error=failed');
    expect((await finish(flow)).headers.location).toContain('error=failed');
    expect(exchange).not.toHaveBeenCalled();
  });
  it.each([{ nonce: 'wrong-nonce' }, { email_verified: false }])('rejects mismatched nonce or unverified email: %j', async (claims) => {
    const flow = await begin(); mockGoogle(flow.url.searchParams.get('nonce')!, claims);
    expect((await finish(flow)).headers.location).toContain('error=failed');
    expect(await prisma.user.count()).toBe(0);
  });
  it('does not issue a session when cryptographic verification fails', async () => {
    const flow = await begin(); const { verify } = mockGoogle(flow.url.searchParams.get('nonce')!);
    verify.mockRejectedValue(new Error('Invalid audience or signature'));
    const response = await finish(flow);
    expect(response.headers.location).toContain('error=failed');
    expect(response.cookies.find(c => c.name === 'access_token')).toBeUndefined();
  });
  it('associates an authoritative email without replacing profile, password or session version', async () => {
    const user = await prisma.user.create({ data: { email: 'parent@gmail.com', name: 'Existing Parent', passwordHash: 'existing-hash', sessionVersion: 5, avatarUrl: 'saved-photo' } });
    const flow = await begin(); mockGoogle(flow.url.searchParams.get('nonce')!);
    expect((await finish(flow)).headers.location).not.toContain('error=');
    expect(await prisma.user.count()).toBe(1);
    expect(await prisma.user.findUnique({ where: { id: user.id } })).toMatchObject({ passwordHash: 'existing-hash', name: 'Existing Parent', sessionVersion: 5, avatarUrl: 'saved-photo' });
  });
  it('refuses automatic email association for a third-party mailbox', async () => {
    await prisma.user.create({ data: { email: 'parent@example.com', name: 'Existing', passwordHash: 'hash' } });
    const flow = await begin(); mockGoogle(flow.url.searchParams.get('nonce')!, { email: 'parent@example.com' });
    expect((await finish(flow)).headers.location).toContain('error=email_verification_required');
    expect(await prisma.googleIdentity.count()).toBe(0);
  });
  it('does not replace an account already linked to another Google subject', async () => {
    await prisma.user.create({ data: { email: 'parent@gmail.com', name: 'Existing', passwordHash: 'hash', googleIdentity: { create: { subject: 'another-subject' } } } });
    const flow = await begin(); mockGoogle(flow.url.searchParams.get('nonce')!);
    expect((await finish(flow)).headers.location).toContain('error=email_verification_required');
    expect(await prisma.googleIdentity.findUnique({ where: { subject } })).toBeNull();
  });
  it('keeps using subject when the Google email changes, and removes the link on account deletion', async () => {
    const user = await prisma.user.create({ data: { email: 'old@example.com', name: 'Existing', passwordHash: 'hash', googleIdentity: { create: { subject } } } });
    const flow = await begin(); mockGoogle(flow.url.searchParams.get('nonce')!, { email: 'changed@example.com' });
    expect((await finish(flow)).headers.location).not.toContain('error=');
    expect(await prisma.user.count()).toBe(1);
    await prisma.user.delete({ where: { id: user.id } });
    expect(await prisma.googleIdentity.count()).toBe(0);
  });
});
