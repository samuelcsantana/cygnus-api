import { z } from 'zod';
import type { App } from '../../../infrastructure/http/build-app';
import { UpdateUserProfileUseCase } from '../../../application/user/update-user-profile.use-case';
import { DeleteUserAccountUseCase } from '../../../application/user/delete-user-account.use-case';
import { EmailAlreadyInUseError } from '../../../application/user/errors/email-already-in-use.error';
import { UserNotFoundError } from '../../../application/user/errors/user-not-found.error';
import { DomainError } from '../../../shared/errors/domain-error';
import { PrismaUserRepository } from '../../../infrastructure/database/repositories/prisma-user.repository';
import { BcryptPasswordHasher } from '../../../infrastructure/security/bcrypt-password-hasher';
import { prisma } from '../../../infrastructure/database/prisma-client';
import { authenticate } from '../plugins/authenticate';
import { clearAuthCookies } from '../utils/auth-cookies';
import { authErrorResponseSchema, currentUserResponseSchema } from '../schemas/auth.schema';
import { deleteAccountBodySchema, updateProfileBodySchema } from '../schemas/user.schema';

export async function userRoutes(app: App) {
  const userRepository = new PrismaUserRepository(prisma);
  const passwordHasher = new BcryptPasswordHasher();
  const updateUserProfileUseCase = new UpdateUserProfileUseCase(userRepository, passwordHasher);
  const deleteUserAccountUseCase = new DeleteUserAccountUseCase(userRepository, passwordHasher);

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
          email: request.body.email,
          password: request.body.password,
          currentPassword: request.body.currentPassword,
        });

        return reply.status(200).send({
          id: user.id,
          email: user.email,
          name: user.name,
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
    method: 'DELETE',
    url: '/users/me',
    preHandler: authenticate,
    schema: {
      tags: ['Users'],
      summary: "Delete the authenticated user's account",
      description:
        'Permanently deletes the account after confirming currentPassword, cascading to all owned babies, ' +
        'their vaccine records, appointments, milestones and notifications. Clears the session cookies.',
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
        await deleteUserAccountUseCase.execute({
          userId: request.userId,
          currentPassword: request.body.currentPassword,
        });

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
