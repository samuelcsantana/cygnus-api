import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { emailService } from '../../src/infrastructure/email/email-service.instance';
import { buildApp } from '../../src/infrastructure/http/build-app';
import { prisma } from '../../src/infrastructure/database/prisma-client';
import { redis } from '../../src/infrastructure/cache/redis-client';
import { VACCINE_CATALOG_CACHE_KEY } from '../../src/infrastructure/database/repositories/cached-vaccine.repository';
import { VACCINE_CATALOG_SEED } from '../../prisma/vaccine-catalog-seed-data';
import { DEMO_ACCOUNT_LIFETIME_MS } from '../../src/domain/user/user';
import { DeleteExpiredDemoAccountsUseCase } from '../../src/application/demo/delete-expired-demo-accounts.use-case';
import { PrismaDemoAccountRepository } from '../../src/infrastructure/database/repositories/prisma-demo-account.repository';

function cookieValues(setCookieHeader: string | string[] | undefined): string[] {
  return Array.isArray(setCookieHeader) ? setCookieHeader : setCookieHeader ? [setCookieHeader] : [];
}

function extractCookieHeader(setCookieHeader: string | string[] | undefined): string {
  return cookieValues(setCookieHeader).map((cookie) => cookie.split(';')[0]).join('; ');
}

function extractCsrfToken(setCookieHeader: string | string[] | undefined): string {
  const csrfCookie = cookieValues(setCookieHeader).find((value) => value.startsWith('csrf_token='));
  return csrfCookie?.split(';')[0]?.split('=')[1] ?? '';
}

describe('Demo accounts', () => {
  let app: Awaited<ReturnType<typeof buildApp>>;

  beforeAll(async () => {
    app = await buildApp();
    await app.ready();

    for (const vaccine of VACCINE_CATALOG_SEED) {
      await prisma.vaccine.upsert({
        where: { scheduleVersion_code: { scheduleVersion: vaccine.scheduleVersion, code: vaccine.code } },
        update: { isActive: true },
        create: vaccine,
      });
    }

    await redis.del(VACCINE_CATALOG_CACHE_KEY);
  });

  afterAll(async () => {
    await app.close();
    await prisma.$disconnect();
  });

  beforeEach(async () => {
    await prisma.user.deleteMany();
  });

  async function startDemo() {
    const response = await app.inject({ method: 'POST', url: '/auth/demo' });
    return {
      response,
      cookie: extractCookieHeader(response.headers['set-cookie']),
      csrfToken: extractCsrfToken(response.headers['set-cookie']),
    };
  }

  describe('POST /auth/demo', () => {
    it('signs the caller into a new account that expires in 24 hours', async () => {
      const before = Date.now();
      const { response, cookie } = await startDemo();

      expect(response.statusCode).toBe(201);
      expect(cookieValues(response.headers['set-cookie']).map((value) => value.split('=')[0])).toEqual(
        expect.arrayContaining(['access_token', 'refresh_token', 'csrf_token']),
      );

      const expiresAt = new Date(response.json().expiresAt).getTime();
      expect(expiresAt).toBeGreaterThanOrEqual(before + DEMO_ACCOUNT_LIFETIME_MS);
      expect(expiresAt).toBeLessThanOrEqual(Date.now() + DEMO_ACCOUNT_LIFETIME_MS);

      const me = await app.inject({ method: 'GET', url: '/auth/me', headers: { cookie } });
      expect(me.statusCode).toBe(200);
      expect(me.json()).toMatchObject({
        name: 'Marina Costa',
        emailNotificationsEnabled: false,
        demoExpiresAt: response.json().expiresAt,
      });
      expect(me.json().email).toMatch(/@demo\.cygnus\.invalid$/);
    });

    it('creates a separate account on every call, so visitors never share data', async () => {
      const first = await startDemo();
      const second = await startDemo();

      const [firstMe, secondMe] = await Promise.all([
        app.inject({ method: 'GET', url: '/auth/me', headers: { cookie: first.cookie } }),
        app.inject({ method: 'GET', url: '/auth/me', headers: { cookie: second.cookie } }),
      ]);

      expect(firstMe.json().id).not.toBe(secondMe.json().id);
      expect(await prisma.user.count({ where: { demoExpiresAt: { not: null } } })).toBe(2);
    });

    it('opens on a family the app can show: children, a mixed vaccine card, appointments, milestones', async () => {
      const { cookie } = await startDemo();

      const babies = await app.inject({ method: 'GET', url: '/babies', headers: { cookie } });
      expect(babies.statusCode).toBe(200);
      const names = (babies.json() as { name: string }[]).map((baby) => baby.name).sort();
      expect(names).toEqual(['Helena', 'Theo']);

      const helena = (babies.json() as { id: string; name: string }[]).find((baby) => baby.name === 'Helena')!;
      const schedule = await app.inject({ method: 'GET', url: `/babies/${helena.id}/vaccines`, headers: { cookie } });
      expect(schedule.statusCode).toBe(200);
      const statuses = (schedule.json().groups as { items: { status: string }[] }[]).flatMap((group) =>
        group.items.map((item) => item.status),
      );
      expect(statuses).toContain('APPLIED');
      expect(statuses.filter((status) => status === 'DELAYED')).toHaveLength(1);
      expect(statuses).toContain('PENDING');

      const appointments = await app.inject({ method: 'GET', url: `/babies/${helena.id}/appointments`, headers: { cookie } });
      expect(appointments.statusCode).toBe(200);
      expect((appointments.json() as { status: string }[]).map((item) => item.status)).toEqual(
        expect.arrayContaining(['COMPLETED', 'SCHEDULED']),
      );

      const milestones = await app.inject({ method: 'GET', url: `/babies/${helena.id}/milestones`, headers: { cookie } });
      expect((milestones.json() as unknown[]).length).toBeGreaterThan(0);

      const specialists = await app.inject({ method: 'GET', url: '/specialists', headers: { cookie } });
      expect((specialists.json() as unknown[]).length).toBe(2);
    });

    it('lets the visitor record the overdue dose, which is why it is not a read-only account', async () => {
      const { cookie, csrfToken } = await startDemo();
      const babies = await app.inject({ method: 'GET', url: '/babies', headers: { cookie } });
      const helena = (babies.json() as { id: string; name: string }[]).find((baby) => baby.name === 'Helena')!;
      const schedule = await app.inject({ method: 'GET', url: `/babies/${helena.id}/vaccines`, headers: { cookie } });
      const overdue = (schedule.json().groups as { items: { vaccineId: string; status: string }[] }[])
        .flatMap((group) => group.items)
        .find((item) => item.status === 'DELAYED')!;

      const applied = await app.inject({
        method: 'PATCH',
        url: `/babies/${helena.id}/vaccines/${overdue.vaccineId}/apply`,
        headers: { cookie, 'x-csrf-token': csrfToken },
        payload: {},
      });

      expect(applied.statusCode).toBe(200);
      const after = await app.inject({ method: 'GET', url: `/babies/${helena.id}/vaccines`, headers: { cookie } });
      const statuses = (after.json().groups as { items: { status: string }[] }[]).flatMap((group) =>
        group.items.map((item) => item.status),
      );
      expect(statuses).not.toContain('DELAYED');
    });

    it('cannot be renewed once it has expired, even before the sweep deletes it', async () => {
      const { response } = await startDemo();
      await prisma.user.updateMany({
        where: { demoExpiresAt: { not: null } },
        data: { demoExpiresAt: new Date(Date.now() - 1000) },
      });

      const refresh = await app.inject({
        method: 'POST',
        url: '/auth/refresh',
        headers: { cookie: extractCookieHeader(response.headers['set-cookie']) },
      });

      expect(refresh.statusCode).toBe(401);
    });

    it('can invite a co-parent by code, but never makes the app mail the address it typed', async () => {
      const sendInvite = vi.spyOn(emailService, 'sendGuardianInviteEmail');
      const { cookie, csrfToken } = await startDemo();
      const babies = await app.inject({ method: 'GET', url: '/babies', headers: { cookie } });
      const helena = (babies.json() as { id: string; name: string }[]).find((baby) => baby.name === 'Helena')!;

      const invite = await app.inject({
        method: 'POST',
        url: `/babies/${helena.id}/invites`,
        headers: { cookie, 'x-csrf-token': csrfToken },
        payload: { inviteeEmail: 'someone-else@example.com' },
      });

      expect(invite.statusCode).toBe(201);
      expect(invite.json().code).toEqual(expect.any(String));
      expect(sendInvite).not.toHaveBeenCalled();
      sendInvite.mockRestore();
    });

    it('cannot become a permanent account by changing its address', async () => {
      const { cookie, csrfToken } = await startDemo();

      const changed = await app.inject({
        method: 'PATCH',
        url: '/users/me',
        headers: { cookie, 'x-csrf-token': csrfToken },
        payload: { email: 'mine-now@example.com', currentPassword: 'any-guess-at-all' },
      });

      expect(changed.statusCode).toBe(400);
      expect(await prisma.user.count({ where: { email: 'mine-now@example.com' } })).toBe(0);
    });
  });

  describe('the expiry sweep', () => {
    const sweep = () => new DeleteExpiredDemoAccountsUseCase(new PrismaDemoAccountRepository(prisma)).execute();

    it('deletes expired demo accounts with everything they hold, and nothing else', async () => {
      await app.inject({
        method: 'POST',
        url: '/auth/register',
        payload: { email: 'parent@example.com', password: 'S3cur3-Password', name: 'Jane Doe' },
      });
      const realUser = await prisma.user.findUniqueOrThrow({ where: { email: 'parent@example.com' } });
      const expired = await startDemo();
      const live = await startDemo();
      const [expiredId, liveId] = await Promise.all(
        [expired, live].map(async ({ cookie }) =>
          (await app.inject({ method: 'GET', url: '/auth/me', headers: { cookie } })).json().id as string,
        ),
      );
      if (!expiredId || !liveId) throw new Error('Both demo sessions should resolve to an account');
      await prisma.user.update({ where: { id: expiredId }, data: { demoExpiresAt: new Date(Date.now() - 1000) } });
      await prisma.auditLog.createMany({
        data: [expiredId, realUser.id].map((userId) => ({
          userId,
          action: 'vaccine.apply',
          resourceType: 'BabyVaccineRecord',
          resourceId: 'record-id',
        })),
      });

      expect(await sweep()).toBe(1);

      expect(await prisma.user.findUnique({ where: { id: expiredId } })).toBeNull();
      expect(await prisma.baby.count({ where: { userId: expiredId } })).toBe(0);
      expect(await prisma.specialist.count({ where: { userId: expiredId } })).toBe(0);
      expect(await prisma.auditLog.count({ where: { userId: expiredId } })).toBe(0);

      expect(await prisma.baby.count({ where: { userId: liveId } })).toBe(2);
      expect(await prisma.user.findUnique({ where: { id: realUser.id } })).not.toBeNull();
      expect(await prisma.auditLog.count({ where: { userId: realUser.id } })).toBe(1);
    });

    it('finds nothing to do on a second run', async () => {
      await startDemo();
      await prisma.user.updateMany({ data: { demoExpiresAt: new Date(Date.now() - 1000) } });

      expect(await sweep()).toBe(1);
      expect(await sweep()).toBe(0);
    });
  });

  describe('GET /auth/me for a real account', () => {
    it('reports no demo expiry', async () => {
      await app.inject({
        method: 'POST',
        url: '/auth/register',
        payload: { email: 'parent@example.com', password: 'S3cur3-Password', name: 'Jane Doe' },
      });
      const login = await app.inject({
        method: 'POST',
        url: '/auth/login',
        payload: { email: 'parent@example.com', password: 'S3cur3-Password' },
      });

      const me = await app.inject({
        method: 'GET',
        url: '/auth/me',
        headers: { cookie: extractCookieHeader(login.headers['set-cookie']) },
      });

      expect(me.json().demoExpiresAt).toBeNull();
    });
  });
});
