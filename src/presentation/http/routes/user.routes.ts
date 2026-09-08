import { z } from 'zod';
import type { App } from '../../../infrastructure/http/build-app';
import { UpdateUserProfileUseCase } from '../../../application/user/update-user-profile.use-case';
import { DeleteUserAccountUseCase } from '../../../application/user/delete-user-account.use-case';
import { ExportUserDataUseCase } from '../../../application/user/export-user-data.use-case';
import { EmailAlreadyInUseError } from '../../../application/user/errors/email-already-in-use.error';
import { UserNotFoundError } from '../../../application/user/errors/user-not-found.error';
import { DomainError } from '../../../shared/errors/domain-error';
import { PrismaUserRepository } from '../../../infrastructure/database/repositories/prisma-user.repository';
import { emailService } from '../../../infrastructure/email/email-service.instance';
import { verificationCodeService } from '../../../infrastructure/security/verification-code-service.instance';
import { PrismaBabyRepository } from '../../../infrastructure/database/repositories/prisma-baby.repository';
import { PrismaBabyVaccineRecordRepository } from '../../../infrastructure/database/repositories/prisma-baby-vaccine-record.repository';
import { PrismaAppointmentRepository } from '../../../infrastructure/database/repositories/prisma-appointment.repository';
import { PrismaMilestoneRepository } from '../../../infrastructure/database/repositories/prisma-milestone.repository';
import { BcryptPasswordHasher } from '../../../infrastructure/security/bcrypt-password-hasher';
import { prisma } from '../../../infrastructure/database/prisma-client';
import { revokeRefreshTokenIfPresent } from '../../../infrastructure/security/revoke-refresh-token';
import { authenticate } from '../plugins/authenticate';
import { env } from '../../../shared/config/env';
import { authSuccessResponseSchema } from '../schemas/auth.schema';
import { REFRESH_TOKEN_COOKIE, clearAuthCookies } from '../utils/auth-cookies';
import { authErrorResponseSchema, currentUserResponseSchema } from '../schemas/auth.schema';
import { deleteAccountBodySchema, exportUserDataResponseSchema, updateProfileBodySchema } from '../schemas/user.schema';

function toDateOnly(date: Date | null): string | null {
  return date ? date.toISOString().slice(0, 10) : null;
}

export async function userRoutes(app: App) {
  const userRepository = new PrismaUserRepository(prisma);
  const babyRepository = new PrismaBabyRepository(prisma);
  const babyVaccineRecordRepository = new PrismaBabyVaccineRecordRepository(prisma);
  const appointmentRepository = new PrismaAppointmentRepository(prisma);
  const milestoneRepository = new PrismaMilestoneRepository(prisma);
  const passwordHasher = new BcryptPasswordHasher();
  const updateUserProfileUseCase = new UpdateUserProfileUseCase(userRepository, passwordHasher);
  const deleteUserAccountUseCase = new DeleteUserAccountUseCase(userRepository, passwordHasher, verificationCodeService);
  const exportUserDataUseCase = new ExportUserDataUseCase(
    userRepository,
    babyRepository,
    babyVaccineRecordRepository,
    appointmentRepository,
    milestoneRepository,
  );

  app.route({
    method: 'PATCH',
    url: '/users/me',
    preHandler: authenticate,
    schema: {
      tags: ['Users'],
      summary: "Update the authenticated user's profile",
      description:
        'Updates name, email and/or password for the authenticated account. currentPassword is required ' +
        'whenever email or password are being changed.',
      body: updateProfileBodySchema,
      response: {
        200: currentUserResponseSchema,
        400: authErrorResponseSchema,
        401: authErrorResponseSchema,
        409: authErrorResponseSchema,
        500: authErrorResponseSchema,
      },
    },
    handler: async (request, reply) => {
      try {
        const user = await updateUserProfileUseCase.execute({
          userId: request.userId,
          name: request.body.name,
          avatarUrl: request.body.avatarUrl,
          email: request.body.email,
          password: request.body.password,
          currentPassword: request.body.currentPassword,
          emailNotificationsEnabled: request.body.emailNotificationsEnabled,
        });

        return reply.status(200).send({
          id: user.id,
          email: user.email,
          name: user.name,
          avatarUrl: user.avatarUrl,
          emailNotificationsEnabled: user.emailNotificationsEnabled,
          createdAt: user.createdAt.toISOString(),
        });
      } catch (error) {
        if (error instanceof EmailAlreadyInUseError) {
          return reply.status(409).send({ status: 'error', message: error.message });
        }

        if (error instanceof UserNotFoundError) {
          return reply.status(401).send({ status: 'error', message: 'Authentication required' });
        }

        if (error instanceof DomainError) {
          return reply.status(400).send({ status: 'error', message: error.message });
        }

        throw error;
      }
    },
  });

  app.route({
    method: 'GET',
    url: '/users/me/export',
    preHandler: authenticate,
    schema: {
      tags: ['Users'],
      summary: "Export the authenticated user's full data set",
      description:
        'LGPD data portability export: the user profile and, for every baby they own, the baby profile, all ' +
        'vaccine records, appointments and milestones — as a single JSON document.',
      response: {
        200: exportUserDataResponseSchema,
        401: authErrorResponseSchema,
        500: authErrorResponseSchema,
      },
    },
    handler: async (request, reply) => {
      try {
        const data = await exportUserDataUseCase.execute({ userId: request.userId });

        return reply.status(200).send({
          user: {
            id: data.user.id,
            email: data.user.email,
            name: data.user.name,
            avatarUrl: data.user.avatarUrl,
            emailNotificationsEnabled: data.user.emailNotificationsEnabled,
            createdAt: data.user.createdAt.toISOString(),
          },
          babies: data.babies.map(({ baby, vaccineRecords, appointments, milestones }) => ({
            profile: {
              id: baby.id,
              userId: baby.userId,
              name: baby.name,
              birthDate: baby.birthDate.toISOString().slice(0, 10),
              sexAtBirth: baby.sexAtBirth,
              bloodType: baby.bloodType,
              allergies: baby.allergies,
              healthPlanName: baby.healthPlanName,
              healthPlanNumber: baby.healthPlanNumber,
              avatarUrl: baby.avatarUrl,
              avatarColor: baby.avatarColor,
              measurements: baby.measurements.map((measurement) => ({
                ...measurement,
                measuredOn: measurement.measuredOn.toISOString().slice(0, 10),
              })),
              createdAt: baby.createdAt.toISOString(),
            },
            vaccineRecords: vaccineRecords.map((record) => ({
              id: record.id,
              vaccineId: record.vaccineId,
              source: record.source,
              customName: record.customName,
              customDose: record.customDose,
              status: 'APPLIED' as const,
              applicationDate: toDateOnly(record.applicationDate),
              notes: record.notes,
              batchNumber: record.batchNumber,
              location: record.location,
              professional: record.professional,
              photoUrl: record.photoUrl,
            })),
            appointments: appointments.map((appointment) => ({
              id: appointment.id,
              babyId: appointment.babyId,
              scheduledAt: appointment.scheduledAt.toISOString(),
              doctorName: appointment.doctorName,
              specialty: appointment.specialty,
              location: appointment.location,
              reason: appointment.reason,
              notes: appointment.notes,
              status: appointment.status,
              specialistId: appointment.specialistId,
              weightGrams: appointment.weightGrams,
              heightMillimeters: appointment.heightMillimeters,
              createdAt: appointment.createdAt.toISOString(),
            })),
            milestones: milestones.map((milestone) => ({
              id: milestone.id,
              babyId: milestone.babyId,
              title: milestone.title,
              description: milestone.description,
              achievedAt: milestone.achievedAt.toISOString().slice(0, 10),
              category: milestone.category,
              photoUrl: milestone.photoUrl,
              createdAt: milestone.createdAt.toISOString(),
            })),
          })),
        });
      } catch (error) {
        if (error instanceof UserNotFoundError) {
          return reply.status(401).send({ status: 'error', message: 'Authentication required' });
        }

        throw error;
      }
    },
  });

  app.route({
    method: 'POST',
    url: '/users/me/deletion-code',
    preHandler: authenticate,
    // Same ceiling as the assisted flows: this mails somebody, and the address is theirs, but a
    // loop hitting it is still a loop hitting a mailbox.
    config: { rateLimit: { max: env.NODE_ENV === 'test' ? 1000 : 10, timeWindow: '1 minute' } },
    schema: {
      tags: ['Users'],
      summary: 'Mail a code that confirms deleting this account',
      description:
        'Mails a 6-digit code to the address on the account, spendable only on DELETE /users/me. The address is ' +
        'read from the session, never from the request, so the caller cannot choose whose deletion they are ' +
        'confirming. Answers 200 even when the address is throttled — the caller has nothing to do differently.',
      response: {
        200: authSuccessResponseSchema,
        401: authErrorResponseSchema,
        429: authErrorResponseSchema,
        500: authErrorResponseSchema,
      },
    },
    handler: async (request, reply) => {
      const user = await userRepository.findById(request.userId);

      if (!user) {
        return reply.status(401).send({ status: 'error', message: 'Authentication required' });
      }

      const code = await verificationCodeService.issue('account-deletion', user.email);

      if (code) {
        if (env.NODE_ENV !== 'production') {
          // Same escape hatch the assisted flows have, and for the same reason: EmailService
          // no-ops without RESEND_API_KEY, so off-production this flow would be a 200 with
          // nothing behind it.
          request.log.info(
            { purpose: 'account-deletion', email: user.email, code },
            'auth.verification_code_issued (non-production only)',
          );
        }

        // Not awaited, like the assisted flows: a third-party network call has no business
        // deciding how long this response takes, and a delivery failure is not something the
        // caller can act on.
        void emailService.sendAccountDeletionCodeEmail(user.email, code).catch((error: unknown) => {
          request.log.error({ err: error, userId: user.id }, 'auth.deletion_code_email_failed');
        });
      }

      return reply.status(200).send({ status: 'ok', message: 'A code is on its way' });
    },
  });

  app.route({
    method: 'DELETE',
    url: '/users/me',
    preHandler: authenticate,
    schema: {
      tags: ['Users'],
      summary: "Delete the authenticated user's account",
      description:
        'Permanently deletes the account, cascading to all owned babies, their vaccine records, appointments, ' +
        'milestones and notifications, and clears the session cookies. Confirmed by **either** currentPassword or ' +
        'a code from POST /users/me/deletion-code — never both. The code path exists because an account created by ' +
        'passwordless sign-in has no usable password, and would otherwise have no way to delete itself.',
      body: deleteAccountBodySchema,
      response: {
        204: z.null().describe('Account deleted successfully'),
        400: authErrorResponseSchema,
        401: authErrorResponseSchema,
        500: authErrorResponseSchema,
      },
    },
    handler: async (request, reply) => {
      try {
        // The schema already refused "neither" and "both", so exactly one of these is set and the
        // narrowing below is the shape the use case asks for.
        await deleteUserAccountUseCase.execute(
          request.body.code !== undefined
            ? { userId: request.userId, code: request.body.code }
            : { userId: request.userId, currentPassword: request.body.currentPassword! },
        );

        await revokeRefreshTokenIfPresent(request.cookies[REFRESH_TOKEN_COOKIE]);
        clearAuthCookies(reply);

        return reply.status(204).send(null);
      } catch (error) {
        if (error instanceof UserNotFoundError) {
          return reply.status(401).send({ status: 'error', message: 'Authentication required' });
        }

        if (error instanceof DomainError) {
          return reply.status(400).send({ status: 'error', message: error.message });
        }

        throw error;
      }
    },
  });
}
