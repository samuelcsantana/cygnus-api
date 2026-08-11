import { FastifyInstance } from 'fastify';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { buildApp } from '../../src/infrastructure/http/build-app';
import { prisma } from '../../src/infrastructure/database/prisma-client';

describe('Invite/guardian routes', () => {
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

  async function createInvite(
    cookie: string,
    csrfToken: string,
    babyId: string,
    inviteeEmail?: string,
  ): Promise<{ code: string; expiresAt: string }> {
    const response = await app.inject({
      method: 'POST',
      url: `/babies/${babyId}/invites`,
      headers: { cookie, 'x-csrf-token': csrfToken },
      payload: inviteeEmail ? { inviteeEmail } : {},
    });

    return response.json();
  }

  describe('POST /babies/:babyId/invites', () => {
    it('creates an invite code for a baby the requester is a guardian of', async () => {
      const { cookie, csrfToken } = await registerAndLogin('invite-owner@example.com');
      const babyId = await createBaby(cookie, csrfToken);

      const response = await app.inject({
        method: 'POST',
        url: `/babies/${babyId}/invites`,
        headers: { cookie, 'x-csrf-token': csrfToken },
        payload: {},
      });

      expect(response.statusCode).toBe(201);
      const body = response.json();
      expect(typeof body.code).toBe('string');
      expect(body.code.length).toBeGreaterThan(0);
      expect(new Date(body.expiresAt).getTime()).toBeGreaterThan(Date.now());
    });

    it("returns 404 when creating an invite for another user's baby", async () => {
      const { cookie: ownerCookie, csrfToken: ownerCsrfToken } = await registerAndLogin('invite-owner-2@example.com');
      const { cookie: intruderCookie, csrfToken: intruderCsrfToken } = await registerAndLogin(
        'invite-intruder@example.com',
      );
      const babyId = await createBaby(ownerCookie, ownerCsrfToken);

      const response = await app.inject({
        method: 'POST',
        url: `/babies/${babyId}/invites`,
        headers: { cookie: intruderCookie, 'x-csrf-token': intruderCsrfToken },
        payload: {},
      });

      expect(response.statusCode).toBe(404);
    });

    it('accepts an optional inviteeEmail without failing the request even though email delivery is unconfigured in tests', async () => {
      const { cookie, csrfToken } = await registerAndLogin('invite-with-email@example.com');
      const babyId = await createBaby(cookie, csrfToken);

      const response = await app.inject({
        method: 'POST',
        url: `/babies/${babyId}/invites`,
        headers: { cookie, 'x-csrf-token': csrfToken },
        payload: { inviteeEmail: 'coparent@example.com' },
      });

      expect(response.statusCode).toBe(201);
    });
  });

  describe('GET /invites/:code', () => {
    it('previews a valid invite without authentication', async () => {
      const { cookie, csrfToken } = await registerAndLogin('invite-preview-owner@example.com');
      const babyId = await createBaby(cookie, csrfToken);
      const invite = await createInvite(cookie, csrfToken, babyId);

      const response = await app.inject({ method: 'GET', url: `/invites/${invite.code}` });

      expect(response.statusCode).toBe(200);
      expect(response.json()).toMatchObject({ babyName: 'Baby', expired: false, alreadyUsed: false });
    });

    it('returns 404 for a code that does not exist', async () => {
      const response = await app.inject({ method: 'GET', url: '/invites/does-not-exist' });

      expect(response.statusCode).toBe(404);
    });

    it('returns 200 with alreadyUsed=true after the invite is redeemed', async () => {
      const { cookie, csrfToken } = await registerAndLogin('invite-preview-used-owner@example.com');
      const { cookie: redeemerCookie, csrfToken: redeemerCsrfToken } = await registerAndLogin(
        'invite-preview-used-redeemer@example.com',
      );
      const babyId = await createBaby(cookie, csrfToken);
      const invite = await createInvite(cookie, csrfToken, babyId);

      await app.inject({
        method: 'POST',
        url: `/invites/${invite.code}/redeem`,
        headers: { cookie: redeemerCookie, 'x-csrf-token': redeemerCsrfToken },
      });

      const response = await app.inject({ method: 'GET', url: `/invites/${invite.code}` });

      expect(response.statusCode).toBe(200);
      expect(response.json()).toMatchObject({ alreadyUsed: true });
    });
  });

  describe('POST /invites/:code/redeem', () => {
    it('grants GUARDIAN access to the baby and lets the new guardian read its data', async () => {
      const { cookie: ownerCookie, csrfToken: ownerCsrfToken } = await registerAndLogin('redeem-owner@example.com');
      const { cookie: coParentCookie, csrfToken: coParentCsrfToken } = await registerAndLogin(
        'redeem-co-parent@example.com',
      );
      const babyId = await createBaby(ownerCookie, ownerCsrfToken);
      const invite = await createInvite(ownerCookie, ownerCsrfToken, babyId);

      const redeemResponse = await app.inject({
        method: 'POST',
        url: `/invites/${invite.code}/redeem`,
        headers: { cookie: coParentCookie, 'x-csrf-token': coParentCsrfToken },
      });

      expect(redeemResponse.statusCode).toBe(200);
      expect(redeemResponse.json()).toMatchObject({ babyId, babyName: 'Baby' });

      const getBabyResponse = await app.inject({
        method: 'GET',
        url: `/babies/${babyId}`,
        headers: { cookie: coParentCookie, 'x-csrf-token': coParentCsrfToken },
      });
      expect(getBabyResponse.statusCode).toBe(200);

      const listBabiesResponse = await app.inject({
        method: 'GET',
        url: '/babies',
        headers: { cookie: coParentCookie, 'x-csrf-token': coParentCsrfToken },
      });
      expect(listBabiesResponse.json().map((baby: { id: string }) => baby.id)).toContain(babyId);
    });

    it('returns 404 for a code that does not exist', async () => {
      const { cookie, csrfToken } = await registerAndLogin('redeem-missing-code@example.com');

      const response = await app.inject({
        method: 'POST',
        url: '/invites/does-not-exist/redeem',
        headers: { cookie, 'x-csrf-token': csrfToken },
      });

      expect(response.statusCode).toBe(404);
    });

    it('returns 410 for an already-used invite', async () => {
      const { cookie: ownerCookie, csrfToken: ownerCsrfToken } = await registerAndLogin('redeem-used-owner@example.com');
      const { cookie: firstRedeemerCookie, csrfToken: firstRedeemerCsrfToken } = await registerAndLogin(
        'redeem-used-first@example.com',
      );
      const { cookie: secondRedeemerCookie, csrfToken: secondRedeemerCsrfToken } = await registerAndLogin(
        'redeem-used-second@example.com',
      );
      const babyId = await createBaby(ownerCookie, ownerCsrfToken);
      const invite = await createInvite(ownerCookie, ownerCsrfToken, babyId);

      await app.inject({
        method: 'POST',
        url: `/invites/${invite.code}/redeem`,
        headers: { cookie: firstRedeemerCookie, 'x-csrf-token': firstRedeemerCsrfToken },
      });

      const response = await app.inject({
        method: 'POST',
        url: `/invites/${invite.code}/redeem`,
        headers: { cookie: secondRedeemerCookie, 'x-csrf-token': secondRedeemerCsrfToken },
      });

      expect(response.statusCode).toBe(410);
    });

    it('returns 409 when the requester is already a guardian of the baby', async () => {
      const { cookie, csrfToken } = await registerAndLogin('redeem-already-guardian@example.com');
      const babyId = await createBaby(cookie, csrfToken);
      const invite = await createInvite(cookie, csrfToken, babyId);

      const response = await app.inject({
        method: 'POST',
        url: `/invites/${invite.code}/redeem`,
        headers: { cookie, 'x-csrf-token': csrfToken },
      });

      expect(response.statusCode).toBe(409);
    });
  });

  describe('GET /babies/:babyId/guardians', () => {
    it('lists the OWNER and every redeemed GUARDIAN', async () => {
      const { cookie: ownerCookie, csrfToken: ownerCsrfToken } = await registerAndLogin('list-guardians-owner@example.com');
      const { cookie: coParentCookie, csrfToken: coParentCsrfToken } = await registerAndLogin(
        'list-guardians-co-parent@example.com',
      );
      const babyId = await createBaby(ownerCookie, ownerCsrfToken);
      const invite = await createInvite(ownerCookie, ownerCsrfToken, babyId);

      await app.inject({
        method: 'POST',
        url: `/invites/${invite.code}/redeem`,
        headers: { cookie: coParentCookie, 'x-csrf-token': coParentCsrfToken },
      });

      const response = await app.inject({
        method: 'GET',
        url: `/babies/${babyId}/guardians`,
        headers: { cookie: ownerCookie, 'x-csrf-token': ownerCsrfToken },
      });

      expect(response.statusCode).toBe(200);
      const guardians = response.json();
      expect(guardians).toHaveLength(2);
      expect(guardians.map((guardian: { role: string }) => guardian.role).sort()).toEqual(['GUARDIAN', 'OWNER']);
    });

    it("returns 404 for a baby the requester doesn't have access to", async () => {
      const { cookie: ownerCookie, csrfToken: ownerCsrfToken } = await registerAndLogin('list-guardians-owner-2@example.com');
      const { cookie: intruderCookie, csrfToken: intruderCsrfToken } = await registerAndLogin(
        'list-guardians-intruder@example.com',
      );
      const babyId = await createBaby(ownerCookie, ownerCsrfToken);

      const response = await app.inject({
        method: 'GET',
        url: `/babies/${babyId}/guardians`,
        headers: { cookie: intruderCookie, 'x-csrf-token': intruderCsrfToken },
      });

      expect(response.statusCode).toBe(404);
    });
  });

  describe('DELETE /babies/:babyId/guardians/:userId', () => {
    async function setupSharedBaby() {
      const { cookie: ownerCookie, csrfToken: ownerCsrfToken } = await registerAndLogin(
        `remove-guardian-owner-${Date.now()}@example.com`,
      );
      const { cookie: coParentCookie, csrfToken: coParentCsrfToken } = await registerAndLogin(
        `remove-guardian-co-parent-${Date.now()}@example.com`,
      );
      const babyId = await createBaby(ownerCookie, ownerCsrfToken);
      const invite = await createInvite(ownerCookie, ownerCsrfToken, babyId);

      await app.inject({
        method: 'POST',
        url: `/invites/${invite.code}/redeem`,
        headers: { cookie: coParentCookie, 'x-csrf-token': coParentCsrfToken },
      });

      const meResponse = await app.inject({ method: 'GET', url: '/auth/me', headers: { cookie: coParentCookie } });
      const coParentUserId = meResponse.json().id;

      return { ownerCookie, ownerCsrfToken, coParentCookie, coParentCsrfToken, babyId, coParentUserId };
    }

    it('lets the OWNER remove a GUARDIAN', async () => {
      const { ownerCookie, ownerCsrfToken, babyId, coParentUserId } = await setupSharedBaby();

      const response = await app.inject({
        method: 'DELETE',
        url: `/babies/${babyId}/guardians/${coParentUserId}`,
        headers: { cookie: ownerCookie, 'x-csrf-token': ownerCsrfToken },
      });

      expect(response.statusCode).toBe(204);

      const listResponse = await app.inject({
        method: 'GET',
        url: `/babies/${babyId}/guardians`,
        headers: { cookie: ownerCookie, 'x-csrf-token': ownerCsrfToken },
      });
      expect(listResponse.json()).toHaveLength(1);
    });

    it('lets a GUARDIAN remove themselves ("leave")', async () => {
      const { coParentCookie, coParentCsrfToken, babyId, coParentUserId } = await setupSharedBaby();

      const response = await app.inject({
        method: 'DELETE',
        url: `/babies/${babyId}/guardians/${coParentUserId}`,
        headers: { cookie: coParentCookie, 'x-csrf-token': coParentCsrfToken },
      });

      expect(response.statusCode).toBe(204);
    });

    it('returns 400 when trying to remove the OWNER', async () => {
      const { ownerCookie, ownerCsrfToken, babyId } = await setupSharedBaby();
      const meResponse = await app.inject({ method: 'GET', url: '/auth/me', headers: { cookie: ownerCookie } });
      const ownerUserId = meResponse.json().id;

      const response = await app.inject({
        method: 'DELETE',
        url: `/babies/${babyId}/guardians/${ownerUserId}`,
        headers: { cookie: ownerCookie, 'x-csrf-token': ownerCsrfToken },
      });

      expect(response.statusCode).toBe(400);
    });

    it('returns 403 when a non-OWNER guardian tries to remove another guardian', async () => {
      const { ownerCookie, ownerCsrfToken, coParentCookie, coParentCsrfToken, babyId } = await setupSharedBaby();

      const { cookie: secondCoParentCookie, csrfToken: secondCoParentCsrfToken } = await registerAndLogin(
        `remove-guardian-second-co-parent-${Date.now()}@example.com`,
      );
      const secondInvite = await createInvite(ownerCookie, ownerCsrfToken, babyId);
      await app.inject({
        method: 'POST',
        url: `/invites/${secondInvite.code}/redeem`,
        headers: { cookie: secondCoParentCookie, 'x-csrf-token': secondCoParentCsrfToken },
      });

      const meResponse = await app.inject({
        method: 'GET',
        url: '/auth/me',
        headers: { cookie: secondCoParentCookie },
      });
      const secondCoParentUserId = meResponse.json().id;

      const response = await app.inject({
        method: 'DELETE',
        url: `/babies/${babyId}/guardians/${secondCoParentUserId}`,
        headers: { cookie: coParentCookie, 'x-csrf-token': coParentCsrfToken },
      });

      expect(response.statusCode).toBe(403);
    });
  });

  it('exposes all invite/guardian routes in the generated OpenAPI document', async () => {
    const response = await app.inject({ method: 'GET', url: '/docs/json' });
    const openApiDocument = response.json();

    expect(openApiDocument.paths['/babies/{babyId}/invites'].post.tags).toContain('Guardians');
    expect(openApiDocument.paths['/invites/{code}'].get.tags).toContain('Guardians');
    expect(openApiDocument.paths['/invites/{code}/redeem'].post.tags).toContain('Guardians');
    expect(openApiDocument.paths['/babies/{babyId}/guardians'].get.tags).toContain('Guardians');
    expect(openApiDocument.paths['/babies/{babyId}/guardians/{userId}'].delete.tags).toContain('Guardians');
  });
});
