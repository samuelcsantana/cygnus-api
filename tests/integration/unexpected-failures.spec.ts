import { randomUUID } from 'node:crypto';
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { buildApp } from '../../src/infrastructure/http/build-app';
import { prisma } from '../../src/infrastructure/database/prisma-client';
import { CreateAppointmentUseCase } from '../../src/application/appointment/create-appointment.use-case';
import { DeleteAppointmentUseCase } from '../../src/application/appointment/delete-appointment.use-case';
import { GetAppointmentByIdUseCase } from '../../src/application/appointment/get-appointment-by-id.use-case';
import { ListBabyAppointmentsUseCase } from '../../src/application/appointment/list-baby-appointments.use-case';
import { UpdateAppointmentUseCase } from '../../src/application/appointment/update-appointment.use-case';
import { CreateBabyUseCase } from '../../src/application/baby/create-baby.use-case';
import { DeleteBabyUseCase } from '../../src/application/baby/delete-baby.use-case';
import { GetBabyByIdUseCase } from '../../src/application/baby/get-baby-by-id.use-case';
import { ListBabyGuardiansUseCase } from '../../src/application/baby/list-baby-guardians.use-case';
import { RemoveBabyGuardianUseCase } from '../../src/application/baby/remove-baby-guardian.use-case';
import { UpdateBabyUseCase } from '../../src/application/baby/update-baby.use-case';
import { CheckHealthUseCase } from '../../src/application/health/check-health.use-case';
import { CreateBabyInviteUseCase } from '../../src/application/invite/create-baby-invite.use-case';
import { GetInviteByCodeUseCase } from '../../src/application/invite/get-invite-by-code.use-case';
import { RedeemInviteUseCase } from '../../src/application/invite/redeem-invite.use-case';
import { CreateMedicationUseCase } from '../../src/application/medication/create-medication.use-case';
import { DeleteMedicationUseCase } from '../../src/application/medication/delete-medication.use-case';
import { ListBabyMedicationsUseCase } from '../../src/application/medication/list-baby-medications.use-case';
import { UpdateMedicationUseCase } from '../../src/application/medication/update-medication.use-case';
import { CreateMilestoneUseCase } from '../../src/application/milestone/create-milestone.use-case';
import { DeleteMilestoneUseCase } from '../../src/application/milestone/delete-milestone.use-case';
import { GetMilestoneByIdUseCase } from '../../src/application/milestone/get-milestone-by-id.use-case';
import { ListBabyMilestonesUseCase } from '../../src/application/milestone/list-baby-milestones.use-case';
import { UpdateMilestoneUseCase } from '../../src/application/milestone/update-milestone.use-case';
import { MarkNotificationAsReadUseCase } from '../../src/application/notification/mark-notification-as-read.use-case';
import { CreateSpecialistUseCase } from '../../src/application/specialist/create-specialist.use-case';
import { DeleteSpecialistUseCase } from '../../src/application/specialist/delete-specialist.use-case';
import { UpdateSpecialistUseCase } from '../../src/application/specialist/update-specialist.use-case';
import { AuthenticateUserUseCase } from '../../src/application/user/authenticate-user.use-case';
import { DeleteUserAccountUseCase } from '../../src/application/user/delete-user-account.use-case';
import { ExportUserDataUseCase } from '../../src/application/user/export-user-data.use-case';
import { RefreshUserSessionUseCase } from '../../src/application/user/refresh-user-session.use-case';
import { RegisterUserUseCase } from '../../src/application/user/register-user.use-case';
import { ResetPasswordUseCase } from '../../src/application/user/reset-password.use-case';
import { UpdateUserProfileUseCase } from '../../src/application/user/update-user-profile.use-case';
import { VerifyPasswordlessCodeUseCase } from '../../src/application/user/verify-passwordless-code.use-case';
import { DeleteAdhocVaccineRecordUseCase } from '../../src/application/vaccine/delete-adhoc-vaccine-record.use-case';
import { GetBabyVaccineScheduleUseCase } from '../../src/application/vaccine/get-baby-vaccine-schedule.use-case';
import { ListAdhocVaccineRecordsUseCase } from '../../src/application/vaccine/list-adhoc-vaccine-records.use-case';
import { MarkVaccineAsAppliedUseCase } from '../../src/application/vaccine/mark-vaccine-as-applied.use-case';
import { RegisterAdhocVaccineUseCase } from '../../src/application/vaccine/register-adhoc-vaccine.use-case';

/**
 * Every handler maps the errors it expects (not found, forbidden, invalid) to a status and
 * rethrows the rest. This pins the rethrow: a failure nobody planned for - the database dropping,
 * a bug in a use case - must reach the error handler as a 500 with a generic message, not be
 * mistaken for a 4xx the client caused, and never echo the internal message back.
 *
 * One table instead of one test per route, because the guarantee is the same everywhere; what
 * differs per row is only how to get past authentication and the request schema.
 */
describe('unexpected failures inside a route', () => {
  const EMAIL = 'unexpected-failures@example.com';
  const PASSWORD = 'S3cur3-Password';
  const INTERNAL_MESSAGE = 'connection terminated unexpectedly';
  let app: Awaited<ReturnType<typeof buildApp>>;
  let session: Record<string, string>;

  const babyId = randomUUID();
  const childId = randomUUID();

  beforeAll(async () => {
    app = await buildApp();
    await app.ready();
    await prisma.user.deleteMany({ where: { email: EMAIL } });
    await app.inject({ method: 'POST', url: '/auth/register', payload: { email: EMAIL, password: PASSWORD, name: 'Parent' } });
    const login = await app.inject({ method: 'POST', url: '/auth/login', payload: { email: EMAIL, password: PASSWORD } });
    const cookies = [login.headers['set-cookie']].flat().filter((value): value is string => typeof value === 'string');
    const csrf = cookies.find((value) => value.startsWith('csrf_token='))?.split(';')[0]?.split('=')[1] ?? '';
    session = { cookie: cookies.map((value) => value.split(';')[0]).join('; '), 'x-csrf-token': csrf };
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  afterAll(async () => {
    await prisma.user.deleteMany({ where: { email: EMAIL } });
    await app.close();
    await prisma.$disconnect();
  });

  type UseCaseClass = { prototype: { execute: (...args: never[]) => unknown } };
  type Auth = 'session' | 'none' | 'refresh-cookie';
  type Row = [label: string, useCase: UseCaseClass, method: 'GET' | 'POST' | 'PATCH' | 'DELETE', url: string, payload?: object, auth?: Auth];

  const rows: Row[] = [
    ['register', RegisterUserUseCase, 'POST', '/auth/register', { email: 'someone-new@example.com', password: PASSWORD, name: 'New' }, 'none'],
    ['login', AuthenticateUserUseCase, 'POST', '/auth/login', { email: EMAIL, password: PASSWORD }, 'none'],
    ['refresh', RefreshUserSessionUseCase, 'POST', '/auth/refresh', undefined, 'refresh-cookie'],
    ['passwordless verify', VerifyPasswordlessCodeUseCase, 'POST', '/auth/passwordless/verify', { email: EMAIL, code: '123456' }, 'none'],
    ['password reset verify', ResetPasswordUseCase, 'POST', '/auth/password-reset/verify', { email: EMAIL, code: '123456', password: 'An0ther-Password' }, 'none'],
    ['health', CheckHealthUseCase, 'GET', '/health', undefined, 'none'],
    ['create baby', CreateBabyUseCase, 'POST', '/babies', { name: 'Alice', birthDate: '2024-03-10' }],
    ['get baby', GetBabyByIdUseCase, 'GET', `/babies/${babyId}`],
    ['update baby', UpdateBabyUseCase, 'PATCH', `/babies/${babyId}`, { name: 'Alice Maria' }],
    ['delete baby', DeleteBabyUseCase, 'DELETE', `/babies/${babyId}`],
    ['create appointment', CreateAppointmentUseCase, 'POST', `/babies/${babyId}/appointments`, { scheduledAt: '2099-01-10T10:00:00.000Z', doctorName: 'Dra. Ana' }],
    ['list appointments', ListBabyAppointmentsUseCase, 'GET', `/babies/${babyId}/appointments`],
    ['get appointment', GetAppointmentByIdUseCase, 'GET', `/babies/${babyId}/appointments/${childId}`],
    ['update appointment', UpdateAppointmentUseCase, 'PATCH', `/babies/${babyId}/appointments/${childId}`, { notes: 'Follow-up' }],
    ['delete appointment', DeleteAppointmentUseCase, 'DELETE', `/babies/${babyId}/appointments/${childId}`],
    ['create medication', CreateMedicationUseCase, 'POST', `/babies/${babyId}/medications`, { name: 'Vitamina D', startedOn: '2024-03-10' }],
    ['list medications', ListBabyMedicationsUseCase, 'GET', `/babies/${babyId}/medications`],
    ['update medication', UpdateMedicationUseCase, 'PATCH', `/babies/${babyId}/medications/${childId}`, { dosage: '2 gotas' }],
    ['delete medication', DeleteMedicationUseCase, 'DELETE', `/babies/${babyId}/medications/${childId}`],
    ['create milestone', CreateMilestoneUseCase, 'POST', `/babies/${babyId}/milestones`, { title: 'Primeiro sorriso', achievedAt: '2024-04-10', category: 'SOCIAL' }],
    ['list milestones', ListBabyMilestonesUseCase, 'GET', `/babies/${babyId}/milestones`],
    ['get milestone', GetMilestoneByIdUseCase, 'GET', `/babies/${babyId}/milestones/${childId}`],
    ['update milestone', UpdateMilestoneUseCase, 'PATCH', `/babies/${babyId}/milestones/${childId}`, { description: 'No banho' }],
    ['delete milestone', DeleteMilestoneUseCase, 'DELETE', `/babies/${babyId}/milestones/${childId}`],
    ['create invite', CreateBabyInviteUseCase, 'POST', `/babies/${babyId}/invites`, {}],
    ['preview invite', GetInviteByCodeUseCase, 'GET', '/invites/ABC123'],
    ['redeem invite', RedeemInviteUseCase, 'POST', '/invites/ABC123/redeem', {}],
    ['list guardians', ListBabyGuardiansUseCase, 'GET', `/babies/${babyId}/guardians`],
    ['remove guardian', RemoveBabyGuardianUseCase, 'DELETE', `/babies/${babyId}/guardians/${childId}`],
    ['mark notification read', MarkNotificationAsReadUseCase, 'PATCH', `/notifications/${childId}/read`],
    ['create specialist', CreateSpecialistUseCase, 'POST', '/specialists', { name: 'Dra. Fernanda Lima' }],
    ['update specialist', UpdateSpecialistUseCase, 'PATCH', `/specialists/${childId}`, { name: 'Dra. Fernanda' }],
    ['delete specialist', DeleteSpecialistUseCase, 'DELETE', `/specialists/${childId}`],
    ['update profile', UpdateUserProfileUseCase, 'PATCH', '/users/me', { name: 'Parent Renamed' }],
    ['export data', ExportUserDataUseCase, 'GET', '/users/me/export'],
    ['delete account', DeleteUserAccountUseCase, 'DELETE', '/users/me', { currentPassword: PASSWORD }],
    ['vaccine schedule', GetBabyVaccineScheduleUseCase, 'GET', `/babies/${babyId}/vaccines`],
    ['apply vaccine', MarkVaccineAsAppliedUseCase, 'PATCH', `/babies/${babyId}/vaccines/${childId}/apply`, {}],
    ['list ad hoc vaccines', ListAdhocVaccineRecordsUseCase, 'GET', `/babies/${babyId}/vaccines/adhoc`],
    ['register ad hoc vaccine', RegisterAdhocVaccineUseCase, 'POST', `/babies/${babyId}/vaccines/adhoc`, { source: 'CAMPAIGN', customName: 'Influenza', applicationDate: '2024-04-10' }],
    ['delete ad hoc vaccine', DeleteAdhocVaccineRecordUseCase, 'DELETE', `/babies/${babyId}/vaccines/adhoc/${childId}`],
  ];

  it.each(rows)('%s answers 500 without leaking the cause', async (_label, useCase, method, url, payload, auth = 'session') => {
    const execute = vi.spyOn(useCase.prototype, 'execute').mockRejectedValueOnce(new Error(INTERNAL_MESSAGE));
    // The refresh route answers 401 before reaching the use case unless its own cookie is there.
    const headers = { session, none: {}, 'refresh-cookie': { cookie: 'refresh_token=any' } }[auth];

    const response = await app.inject({ method, url, headers, ...(payload ? { payload } : {}) });

    expect(execute).toHaveBeenCalledTimes(1);
    expect(response.statusCode).toBe(500);
    expect(response.json()).toEqual({ status: 'error', message: 'Internal server error' });
    expect(response.body).not.toContain(INTERNAL_MESSAGE);
  });
});
