import { FastifyInstance } from 'fastify';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { buildApp } from '../../src/infrastructure/http/build-app';
import { prisma } from '../../src/infrastructure/database/prisma-client';

describe('Specialist routes', () => {
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
    await prisma.appointment.deleteMany();
    await prisma.specialist.deleteMany();
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

  interface Session {
    cookie: string;
    csrfToken: string;
    userId: string;
  }

  async function registerAndLogin(email: string): Promise<Session> {
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

    const cookie = extractCookieHeader(loginResponse.headers['set-cookie']);
    const csrfToken = extractCsrfToken(loginResponse.headers['set-cookie']);

    const me = await app.inject({ method: 'GET', url: '/auth/me', headers: { cookie } });

    return { cookie, csrfToken, userId: me.json().id };
  }

  async function createBaby(session: Session, name = 'Baby'): Promise<string> {
    const response = await app.inject({
      method: 'POST',
      url: '/babies',
      headers: { cookie: session.cookie, 'x-csrf-token': session.csrfToken },
      payload: { name, birthDate: '2024-01-01' },
    });

    return response.json().id;
  }

  async function addAsGuardian(owner: Session, babyId: string, guardian: Session): Promise<void> {
    const inviteResponse = await app.inject({
      method: 'POST',
      url: `/babies/${babyId}/invites`,
      headers: { cookie: owner.cookie, 'x-csrf-token': owner.csrfToken },
      payload: {},
    });

    await app.inject({
      method: 'POST',
      url: `/invites/${inviteResponse.json().code}/redeem`,
      headers: { cookie: guardian.cookie, 'x-csrf-token': guardian.csrfToken },
    });
  }

  async function createSpecialist(session: Session, payload: Record<string, unknown>) {
    return app.inject({
      method: 'POST',
      url: '/specialists',
      headers: { cookie: session.cookie, 'x-csrf-token': session.csrfToken },
      payload: { name: 'Dra. Fernanda Lima', ...payload },
    });
  }

  async function listSpecialists(session: Session, query = '') {
    const response = await app.inject({
      method: 'GET',
      url: `/specialists${query}`,
      headers: { cookie: session.cookie, 'x-csrf-token': session.csrfToken },
    });

    return response.json().map((specialist: { name: string }) => specialist.name);
  }

  describe('POST /specialists', () => {
    it('saves a professional linked to no child at all', async () => {
      const owner = await registerAndLogin('spec-private@example.com');

      const response = await createSpecialist(owner, { phone: '+55 11 99999-0000' });

      expect(response.statusCode).toBe(201);
      expect(response.json()).toMatchObject({ babyIds: [], sharedWithUserIds: [], babyId: null });
    });

    it('links a professional to more than one child', async () => {
      const owner = await registerAndLogin('spec-two-kids@example.com');
      const first = await createBaby(owner, 'Ana');
      const second = await createBaby(owner, 'Bruno');

      const response = await createSpecialist(owner, { babyIds: [first, second] });

      expect(response.statusCode).toBe(201);
      expect(response.json().babyIds).toHaveLength(2);
    });

    /**
     * O id da criança vem do cliente. Sem esta checagem, saber um uuid bastaria para pendurar uma
     * entrada na criança de um estranho — e, pela união de visibilidade, fazê-la aparecer na lista
     * daquela família.
     */
    it("refuses to link a professional to a stranger's child", async () => {
      const owner = await registerAndLogin('spec-link-owner@example.com');
      const intruder = await registerAndLogin('spec-link-intruder@example.com');
      const babyId = await createBaby(owner);

      const response = await createSpecialist(intruder, { babyIds: [babyId] });

      expect(response.statusCode).toBe(400);
    });

    it('refuses to share with someone who shares no child with you', async () => {
      const owner = await registerAndLogin('spec-share-owner@example.com');
      const stranger = await registerAndLogin('spec-share-stranger@example.com');
      await createBaby(owner);

      const response = await createSpecialist(owner, { sharedWithUserIds: [stranger.userId] });

      expect(response.statusCode).toBe(400);
    });
  });

  describe('quem enxerga o quê', () => {
    /**
     * A união das três fontes, medida com dois usuários de verdade. É o comportamento inteiro desta
     * feature num teste só: o vínculo com a criança compartilha, a ausência dele não, e o
     * compartilhamento por nome resolve o caso que sobra.
     */
    it('o vínculo com a criança compartilha; sem vínculo, não', async () => {
      const owner = await registerAndLogin('spec-vis-owner@example.com');
      const coGuardian = await registerAndLogin('spec-vis-co@example.com');
      const babyId = await createBaby(owner, 'Compartilhada');
      await addAsGuardian(owner, babyId, coGuardian);

      await createSpecialist(owner, { name: 'Ligada à criança', babyIds: [babyId] });
      await createSpecialist(owner, { name: 'Agenda pessoal' });

      expect(await listSpecialists(owner)).toEqual(['Agenda pessoal', 'Ligada à criança']);
      // A outra responsável vê só a que está ligada à criança que as duas dividem.
      expect(await listSpecialists(coGuardian)).toEqual(['Ligada à criança']);
    });

    it('o compartilhamento por nome alcança quem o vínculo não alcança', async () => {
      const owner = await registerAndLogin('spec-share-flow-owner@example.com');
      const coGuardian = await registerAndLogin('spec-share-flow-co@example.com');
      const babyId = await createBaby(owner);
      await addAsGuardian(owner, babyId, coGuardian);

      await createSpecialist(owner, {
        name: 'Sem criança, compartilhada',
        sharedWithUserIds: [coGuardian.userId],
      });

      expect(await listSpecialists(coGuardian)).toEqual(['Sem criança, compartilhada']);
    });

    it('o filtro por criança estreita a lista, nunca a alarga', async () => {
      const owner = await registerAndLogin('spec-filter@example.com');
      const first = await createBaby(owner, 'Ana');
      const second = await createBaby(owner, 'Bruno');
      await createSpecialist(owner, { name: 'Da Ana', babyIds: [first] });
      await createSpecialist(owner, { name: 'Do Bruno', babyIds: [second] });
      await createSpecialist(owner, { name: 'De ninguém' });

      expect(await listSpecialists(owner, `?babyId=${first}`)).toEqual(['Da Ana']);
    });
  });

  describe('PATCH e DELETE /specialists/:specialistId', () => {
    it('desvincula a última criança quando a lista vem vazia', async () => {
      const owner = await registerAndLogin('spec-unlink@example.com');
      const babyId = await createBaby(owner);
      const created = await createSpecialist(owner, { babyIds: [babyId] });

      const response = await app.inject({
        method: 'PATCH',
        url: `/specialists/${created.json().id}`,
        headers: { cookie: owner.cookie, 'x-csrf-token': owner.csrfToken },
        payload: { babyIds: [] },
      });

      expect(response.statusCode).toBe(200);
      expect(response.json().babyIds).toEqual([]);
    });

    /**
     * Enxergar não é possuir. O telefone de que a outra responsável depende não pode mudar debaixo
     * dela porque alguém arrumou a **própria** agenda — e 404, não 403, para não confirmar a
     * existência do id a quem o adivinhou.
     */
    it('quem só enxerga não edita nem apaga', async () => {
      const owner = await registerAndLogin('spec-edit-owner@example.com');
      const coGuardian = await registerAndLogin('spec-edit-co@example.com');
      const babyId = await createBaby(owner);
      await addAsGuardian(owner, babyId, coGuardian);
      const created = await createSpecialist(owner, { babyIds: [babyId] });
      const specialistId = created.json().id;

      expect(await listSpecialists(coGuardian)).toEqual(['Dra. Fernanda Lima']);

      const patchResponse = await app.inject({
        method: 'PATCH',
        url: `/specialists/${specialistId}`,
        headers: { cookie: coGuardian.cookie, 'x-csrf-token': coGuardian.csrfToken },
        payload: { phone: '+55 11 90000-0000' },
      });
      expect(patchResponse.statusCode).toBe(404);

      const deleteResponse = await app.inject({
        method: 'DELETE',
        url: `/specialists/${specialistId}`,
        headers: { cookie: coGuardian.cookie, 'x-csrf-token': coGuardian.csrfToken },
      });
      expect(deleteResponse.statusCode).toBe(404);
    });

    it('removes the specialist and leaves a recorded visit intact', async () => {
      const owner = await registerAndLogin('spec-delete@example.com');
      const babyId = await createBaby(owner);
      const created = await createSpecialist(owner, { babyIds: [babyId] });
      const specialistId = created.json().id;

      const appointmentResponse = await app.inject({
        method: 'POST',
        url: `/babies/${babyId}/appointments`,
        headers: { cookie: owner.cookie, 'x-csrf-token': owner.csrfToken },
        payload: {
          scheduledAt: '2020-01-01T10:00:00.000Z',
          doctorName: 'Dra. Fernanda Lima',
          status: 'COMPLETED',
          specialistId,
        },
      });
      expect(appointmentResponse.json().specialistId).toBe(specialistId);

      const deleteResponse = await app.inject({
        method: 'DELETE',
        url: `/specialists/${specialistId}`,
        headers: { cookie: owner.cookie, 'x-csrf-token': owner.csrfToken },
      });
      expect(deleteResponse.statusCode).toBe(204);

      const afterDelete = await app.inject({
        method: 'GET',
        url: `/babies/${babyId}/appointments`,
        headers: { cookie: owner.cookie, 'x-csrf-token': owner.csrfToken },
      });

      const appointments = afterDelete.json();
      expect(appointments).toHaveLength(1);
      expect(appointments[0].doctorName).toBe('Dra. Fernanda Lima');
      expect(appointments[0].specialistId).toBeNull();
    });
  });

  describe('as rotas por criança, mantidas como ponte', () => {
    /**
     * O front em produção fala com elas. Sem a ponte, a lista some da tela de edição da criança no
     * intervalo entre os dois deploys, e cadastrar um profissional novo responderia 404.
     */
    it('cadastra e lista pelo caminho antigo, já no modelo novo', async () => {
      const owner = await registerAndLogin('spec-bridge@example.com');
      const babyId = await createBaby(owner);

      const createResponse = await app.inject({
        method: 'POST',
        url: `/babies/${babyId}/specialists`,
        headers: { cookie: owner.cookie, 'x-csrf-token': owner.csrfToken },
        payload: { name: 'Pelo caminho antigo', phone: '+55 11 99999-0000' },
      });

      expect(createResponse.statusCode).toBe(201);
      // O espelho `babyId` é o que o front antigo lê; `babyIds` é o modelo novo por baixo.
      expect(createResponse.json()).toMatchObject({ babyId, babyIds: [babyId] });

      const listResponse = await app.inject({
        method: 'GET',
        url: `/babies/${babyId}/specialists`,
        headers: { cookie: owner.cookie, 'x-csrf-token': owner.csrfToken },
      });

      expect(listResponse.json()).toHaveLength(1);
    });
  });
});
