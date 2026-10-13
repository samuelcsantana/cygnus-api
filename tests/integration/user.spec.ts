import { randomUUID } from 'node:crypto';

import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { buildApp } from '../../src/infrastructure/http/build-app';
import { prisma } from '../../src/infrastructure/database/prisma-client';
import { verificationCodeService } from '../../src/infrastructure/security/verification-code-service.instance';

describe('User profile routes', () => {
  let app: Awaited<ReturnType<typeof buildApp>>;

  beforeAll(async () => {
    app = await buildApp();
    await app.ready();
  });

  afterAll(async () => {
    await app.close();
    await prisma.$disconnect();
  });

  beforeEach(async () => {
    await prisma.baby.deleteMany();
    await prisma.user.deleteMany();
  });

  function extractCookieHeader(setCookieHeader: string | string[] | undefined): string {
    const values = Array.isArray(setCookieHeader) ? setCookieHeader : setCookieHeader ? [setCookieHeader] : [];
    return values.map((cookie) => cookie.split(';')[0] ?? '').join('; ');
  }

  function extractCsrfToken(setCookieHeader: string | string[] | undefined): string {
    const values = Array.isArray(setCookieHeader) ? setCookieHeader : setCookieHeader ? [setCookieHeader] : [];
    const csrfCookie = values.find((value) => value.startsWith('csrf_token='));
    return csrfCookie?.split(';')[0]?.split('=')[1] ?? '';
  }

  async function registerAndLogin(
    email: string,
    password = 'S3cur3-Password',
  ): Promise<{ cookie: string; csrfToken: string }> {
    await app.inject({
      method: 'POST',
      url: '/auth/register',
      payload: { email, password, name: 'Jane Doe' },
    });

    const loginResponse = await app.inject({
      method: 'POST',
      url: '/auth/login',
      payload: { email, password },
    });

    return {
      cookie: extractCookieHeader(loginResponse.headers['set-cookie']),
      csrfToken: extractCsrfToken(loginResponse.headers['set-cookie']),
    };
  }

  describe('PATCH /users/me', () => {
    it('updates only the name without requiring currentPassword', async () => {
      const { cookie, csrfToken } = await registerAndLogin('name-only@example.com');

      const response = await app.inject({
        method: 'PATCH',
        url: '/users/me',
        headers: { cookie, 'x-csrf-token': csrfToken },
        payload: { name: 'Jane Smith' },
      });

      expect(response.statusCode).toBe(200);
      expect(response.json()).toMatchObject({ name: 'Jane Smith', email: 'name-only@example.com' });
    });

    it('rejects an email change without currentPassword with 400', async () => {
      const { cookie, csrfToken } = await registerAndLogin('email-no-pass@example.com');

      const response = await app.inject({
        method: 'PATCH',
        url: '/users/me',
        headers: { cookie, 'x-csrf-token': csrfToken },
        payload: { email: 'new-email@example.com' },
      });

      expect(response.statusCode).toBe(400);
    });

    it('rejects an email change with an incorrect currentPassword with 400', async () => {
      const { cookie, csrfToken } = await registerAndLogin('email-wrong-pass@example.com');

      const response = await app.inject({
        method: 'PATCH',
        url: '/users/me',
        headers: { cookie, 'x-csrf-token': csrfToken },
        payload: { email: 'new-email@example.com', currentPassword: 'wrong-password' },
      });

      expect(response.statusCode).toBe(400);
    });

    it('rejects an email already used by another registered user with 409', async () => {
      await registerAndLogin('taken@example.com');
      const { cookie, csrfToken } = await registerAndLogin('changer@example.com');

      const response = await app.inject({
        method: 'PATCH',
        url: '/users/me',
        headers: { cookie, 'x-csrf-token': csrfToken },
        payload: { email: 'taken@example.com', currentPassword: 'S3cur3-Password' },
      });

      expect(response.statusCode).toBe(409);
    });

    it('changes the password and allows logging in with the new one afterwards', async () => {
      const { cookie, csrfToken } = await registerAndLogin('password-change@example.com');

      const updateResponse = await app.inject({
        method: 'PATCH',
        url: '/users/me',
        headers: { cookie, 'x-csrf-token': csrfToken },
        payload: { password: 'New-Password1', currentPassword: 'S3cur3-Password' },
      });

      expect(updateResponse.statusCode).toBe(200);

      const loginResponse = await app.inject({
        method: 'POST',
        url: '/auth/login',
        payload: { email: 'password-change@example.com', password: 'New-Password1' },
      });

      expect(loginResponse.statusCode).toBe(200);
    });

    /**
     * O caso que motivou a rota do código: conta criada por "entrar sem senha" tem hash aleatório,
     * então **nenhuma senha é a certa** e ela ficava trancada para fora da própria exclusão.
     * Medido antes de existir: 400 "Incorrect current password" numa conta que tinha todo direito
     * de ser apagada.
     */
    it('deletes an account that has no usable password, with a mailed code', async () => {
      const email = `delete-by-code-${randomUUID()}@example.com`;

      // Nasce do código, sem senha nenhuma.
      const signInCode = (await verificationCodeService.issue('passwordless', email))!;
      const session = await app.inject({
        method: 'POST',
        url: '/auth/passwordless/verify',
        payload: { email, code: signInCode },
      });
      const cookie = extractCookieHeader(session.headers['set-cookie']);
      const csrfToken = extractCsrfToken(session.headers['set-cookie']);

      const requested = await app.inject({
        method: 'POST',
        url: '/users/me/deletion-code',
        headers: { cookie, 'x-csrf-token': csrfToken },
      });
      expect(requested.statusCode).toBe(200);

      const deletionCode = (await verificationCodeService.issue('account-deletion', email))!;
      const response = await app.inject({
        method: 'DELETE',
        url: '/users/me',
        headers: { cookie, 'x-csrf-token': csrfToken },
        payload: { code: deletionCode },
      });

      expect(response.statusCode).toBe(204);
      expect(await prisma.user.findUnique({ where: { email } })).toBeNull();
    });

    /**
     * O escopo do código é a propriedade de segurança: um código mandado para **entrar** não pode
     * ser gasto para **apagar**. É a mesma regra que o teste da rota de reset já cobre do outro lado.
     */
    it('refuses a sign-in code on the deletion endpoint', async () => {
      const email = `delete-wrong-purpose-${randomUUID()}@example.com`;
      const { cookie, csrfToken } = await registerAndLogin(email);

      const signInCode = (await verificationCodeService.issue('passwordless', email))!;
      const response = await app.inject({
        method: 'DELETE',
        url: '/users/me',
        headers: { cookie, 'x-csrf-token': csrfToken },
        payload: { code: signInCode },
      });

      expect(response.statusCode).toBe(400);
      expect(await prisma.user.findUnique({ where: { email } })).not.toBeNull();
    });

    it('refuses a wrong code, and leaves the account standing', async () => {
      const email = `delete-wrong-code-${randomUUID()}@example.com`;
      const { cookie, csrfToken } = await registerAndLogin(email);
      await verificationCodeService.issue('account-deletion', email);

      const response = await app.inject({
        method: 'DELETE',
        url: '/users/me',
        headers: { cookie, 'x-csrf-token': csrfToken },
        payload: { code: '000000' },
      });

      expect(response.statusCode).toBe(400);
      expect(await prisma.user.findUnique({ where: { email } })).not.toBeNull();
    });

    /**
     * Nem zero provas nem duas. Corpo vazio apagando conta seria o pior defeito possível aqui, e
     * mandar as duas é um chamador que não decidiu o que está provando.
     */
    it('refuses both proofs at once', async () => {
      const email = `delete-both-${randomUUID()}@example.com`;
      const { cookie, csrfToken } = await registerAndLogin(email);
      const code = (await verificationCodeService.issue('account-deletion', email))!;

      const response = await app.inject({
        method: 'DELETE',
        url: '/users/me',
        headers: { cookie, 'x-csrf-token': csrfToken },
        payload: { currentPassword: 'S3cur3-Password', code },
      });

      expect(response.statusCode).toBe(400);
      expect(await prisma.user.findUnique({ where: { email } })).not.toBeNull();
    });

    it('rejects a request without an access_token cookie with 401', async () => {
      const response = await app.inject({ method: 'PATCH', url: '/users/me', payload: { name: 'Anyone' } });

      expect(response.statusCode).toBe(401);
    });
  });

  describe('GET /users/me/export', () => {
    it("returns the user's profile and every baby's vaccine records, appointments and milestones", async () => {
      const { cookie, csrfToken } = await registerAndLogin('export-me@example.com');

      const createBabyResponse = await app.inject({
        method: 'POST',
        url: '/babies',
        headers: { cookie, 'x-csrf-token': csrfToken },
        payload: { name: 'Alice', birthDate: '2024-01-01', sexAtBirth: 'FEMALE' },
      });
      const babyId = createBabyResponse.json().id;

      await app.inject({
        method: 'POST',
        url: `/babies/${babyId}/milestones`,
        headers: { cookie, 'x-csrf-token': csrfToken },
        payload: { title: 'Primeiro sorriso', achievedAt: '2024-03-01', category: 'SOCIAL' },
      });

      await app.inject({
        method: 'POST',
        url: `/babies/${babyId}/vaccines/adhoc`,
        headers: { cookie, 'x-csrf-token': csrfToken },
        payload: { source: 'CUSTOM', customName: 'Vacina extra', applicationDate: '2024-06-01' },
      });

      const response = await app.inject({
        method: 'GET',
        url: '/users/me/export',
        headers: { cookie, 'x-csrf-token': csrfToken },
      });

      expect(response.statusCode).toBe(200);
      const body = response.json();

      expect(body.user).toMatchObject({ email: 'export-me@example.com', name: 'Jane Doe' });
      expect(body.user.passwordHash).toBeUndefined();
      expect(body.babies).toHaveLength(1);
      expect(body.babies[0].profile).toMatchObject({ id: babyId, name: 'Alice' });
      expect(body.babies[0].milestones).toHaveLength(1);
      expect(body.babies[0].milestones[0].title).toBe('Primeiro sorriso');
      expect(body.babies[0].vaccineRecords).toHaveLength(1);
      expect(body.babies[0].vaccineRecords[0]).toMatchObject({ source: 'CUSTOM', customName: 'Vacina extra' });
      expect(body.babies[0].appointments).toEqual([]);
    });

    it('rejects a request without an access_token cookie with 401', async () => {
      const response = await app.inject({ method: 'GET', url: '/users/me/export' });

      expect(response.statusCode).toBe(401);
    });
  });

  describe('DELETE /users/me', () => {
    it('rejects a request without currentPassword with 400', async () => {
      const { cookie, csrfToken } = await registerAndLogin('delete-no-pass@example.com');

      const response = await app.inject({ method: 'DELETE', url: '/users/me', headers: { cookie, 'x-csrf-token': csrfToken }, payload: {} });

      expect(response.statusCode).toBe(400);
    });

    it('rejects an incorrect currentPassword with 400', async () => {
      const { cookie, csrfToken } = await registerAndLogin('delete-wrong-pass@example.com');

      const response = await app.inject({
        method: 'DELETE',
        url: '/users/me',
        headers: { cookie, 'x-csrf-token': csrfToken },
        payload: { currentPassword: 'wrong-password' },
      });

      expect(response.statusCode).toBe(400);
    });

    it('deletes the account, clears cookies, and revokes the session', async () => {
      const { cookie, csrfToken } = await registerAndLogin('delete-me@example.com');

      const response = await app.inject({
        method: 'DELETE',
        url: '/users/me',
        headers: { cookie, 'x-csrf-token': csrfToken },
        payload: { currentPassword: 'S3cur3-Password' },
      });

      expect(response.statusCode).toBe(204);

      const setCookieHeader = response.headers['set-cookie'];
      const cookies = Array.isArray(setCookieHeader) ? setCookieHeader : [setCookieHeader as string];
      expect(cookies.some((c) => c.includes('access_token=;'))).toBe(true);
      expect(cookies.some((c) => c.includes('refresh_token=;'))).toBe(true);

      const meResponse = await app.inject({ method: 'GET', url: '/auth/me', headers: { cookie, 'x-csrf-token': csrfToken } });
      expect(meResponse.statusCode).toBe(401);

      const loginResponse = await app.inject({
        method: 'POST',
        url: '/auth/login',
        payload: { email: 'delete-me@example.com', password: 'S3cur3-Password' },
      });
      expect(loginResponse.statusCode).toBe(401);
    });

    it('rejects a request without an access_token cookie with 401', async () => {
      const response = await app.inject({ method: 'DELETE', url: '/users/me', payload: { currentPassword: 'x' } });

      expect(response.statusCode).toBe(401);
    });
  });

  // An account opened by a sign-in code has no name until its owner gives one, and nothing stops
  // that owner from opening the profile first. Rebuilding the user with the sign-up rules refused
  // any edit with 400 "Name must not be empty", whatever the edit was.
  it('lets an account without a name yet change its other settings, and still refuses a blank name', async () => {
    const email = `unnamed-profile-${randomUUID()}@example.com`;
    const signIn = await app.inject({
      method: 'POST',
      url: '/auth/passwordless/verify',
      payload: { email, code: (await verificationCodeService.issue('passwordless', email))! },
    });
    const headers = {
      cookie: extractCookieHeader(signIn.headers['set-cookie']),
      'x-csrf-token': extractCsrfToken(signIn.headers['set-cookie']),
    };

    const notifications = await app.inject({ method: 'PATCH', url: '/users/me', headers, payload: { emailNotificationsEnabled: false } });
    const blankName = await app.inject({ method: 'PATCH', url: '/users/me', headers, payload: { name: '   ' } });

    expect(notifications.statusCode).toBe(200);
    expect(notifications.json()).toMatchObject({ name: '', emailNotificationsEnabled: false });
    expect(blankName.statusCode).toBe(400);
    expect((await prisma.user.findUniqueOrThrow({ where: { email } })).emailNotificationsEnabled).toBe(false);
  });

  it('rejects a profile update with no field in it with 400', async () => {
    const { cookie, csrfToken } = await registerAndLogin('empty-patch@example.com');

    const response = await app.inject({ method: 'PATCH', url: '/users/me', headers: { cookie, 'x-csrf-token': csrfToken }, payload: {} });

    expect(response.statusCode).toBe(400);
  });

  it('exports dated measurements and appointments along with the rest', async () => {
    const { cookie, csrfToken } = await registerAndLogin('export-measurements@example.com');
    const headers = { cookie, 'x-csrf-token': csrfToken };
    const baby = await app.inject({
      method: 'POST',
      url: '/babies',
      headers,
      payload: { name: 'Theo', birthDate: '2024-01-01', measurement: { measuredOn: '2024-02-01', weightGrams: 4300, heightMillimeters: 545 } },
    });
    const babyId = baby.json().id;
    await app.inject({
      method: 'POST',
      url: `/babies/${babyId}/appointments`,
      headers,
      payload: { scheduledAt: '2099-03-01T10:00:00.000Z', doctorName: 'Dr. Paulo Mendes' },
    });

    const response = await app.inject({ method: 'GET', url: '/users/me/export', headers });

    expect(response.statusCode).toBe(200);
    const [exported] = response.json().babies;
    expect(exported.profile.measurements).toEqual([expect.objectContaining({ measuredOn: '2024-02-01', weightGrams: 4300, heightMillimeters: 545 })]);
    expect(exported.appointments).toEqual([expect.objectContaining({ doctorName: 'Dr. Paulo Mendes', status: 'SCHEDULED' })]);
  });

  // An access token is not checked against the database on each request, so it outlives an account
  // deleted elsewhere by up to its 15 minutes. The routes that load the account must then answer as
  // if the caller were signed out, not as a server failure.
  describe('a session whose account no longer exists', () => {
    it.each([
      ['PATCH', '/users/me', { name: 'Ghost' }],
      ['GET', '/users/me/export', undefined],
      ['POST', '/users/me/deletion-code', undefined],
      ['DELETE', '/users/me', { currentPassword: 'S3cur3-Password' }],
    ] as const)('%s %s answers 401', async (method, url, payload) => {
      const email = `ghost-${method.toLowerCase()}-${url.split('/').pop()}@example.com`;
      const { cookie, csrfToken } = await registerAndLogin(email);
      await prisma.user.delete({ where: { email } });

      const response = await app.inject({ method, url, headers: { cookie, 'x-csrf-token': csrfToken }, ...(payload ? { payload } : {}) });

      expect(response.statusCode).toBe(401);
      expect(response.json()).toEqual({ status: 'error', message: 'Authentication required' });
    });
  });

  it('exposes all user routes in the generated OpenAPI document', async () => {
    const response = await app.inject({ method: 'GET', url: '/docs/json' });
    const openApiDocument = response.json();

    expect(openApiDocument.paths['/users/me']).toBeDefined();
    expect(openApiDocument.paths['/users/me'].patch.tags).toContain('Users');
    expect(openApiDocument.paths['/users/me'].delete.tags).toContain('Users');
    expect(openApiDocument.paths['/users/me/export'].get.tags).toContain('Users');
  });
});
