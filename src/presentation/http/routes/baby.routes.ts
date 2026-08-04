import { z } from 'zod';
import type { App } from '../../../infrastructure/http/build-app';
import { Baby } from '../../../domain/baby/baby';
import { CreateBabyUseCase } from '../../../application/baby/create-baby.use-case';
import { ListUserBabiesUseCase } from '../../../application/baby/list-user-babies.use-case';
import { GetBabyByIdUseCase } from '../../../application/baby/get-baby-by-id.use-case';
import { UpdateBabyUseCase } from '../../../application/baby/update-baby.use-case';
import { DeleteBabyUseCase } from '../../../application/baby/delete-baby.use-case';
import { BabyNotFoundError } from '../../../application/baby/errors/baby-not-found.error';
import { DomainError } from '../../../shared/errors/domain-error';
import { PrismaBabyRepository } from '../../../infrastructure/database/repositories/prisma-baby.repository';
import { prisma } from '../../../infrastructure/database/prisma-client';
import { authenticate } from '../plugins/authenticate';
import { authErrorResponseSchema } from '../schemas/auth.schema';
import {
  babyListResponseSchema,
  babyParamsSchema,
  babyResponseSchema,
  createBabyBodySchema,
  updateBabyBodySchema,
} from '../schemas/baby.schema';

function toBirthDate(dateOnly: string): Date {
  return new Date(`${dateOnly}T00:00:00.000Z`);
}

function toResponse(baby: Baby) {
  return {
    id: baby.id,
    userId: baby.userId,
    name: baby.name,
    birthDate: baby.birthDate.toISOString().slice(0, 10),
    gender: baby.gender,
    bloodType: baby.bloodType,
    allergies: baby.allergies,
    avatarUrl: baby.avatarUrl,
    createdAt: baby.createdAt.toISOString(),
  };
}

export async function babyRoutes(app: App) {
  const babyRepository = new PrismaBabyRepository(prisma);
  const createBabyUseCase = new CreateBabyUseCase(babyRepository);
  const listUserBabiesUseCase = new ListUserBabiesUseCase(babyRepository);
  const getBabyByIdUseCase = new GetBabyByIdUseCase(babyRepository);
  const updateBabyUseCase = new UpdateBabyUseCase(babyRepository);
  const deleteBabyUseCase = new DeleteBabyUseCase(babyRepository);

  app.route({
    method: 'POST',
    url: '/babies',
    preHandler: authenticate,
    schema: {
      tags: ['Babies'],
      summary: 'Create a baby profile',
      description: 'Creates a new baby profile owned by the authenticated user.',
      body: createBabyBodySchema,
      response: {
        201: babyResponseSchema,
        400: authErrorResponseSchema,
        401: authErrorResponseSchema,
        500: authErrorResponseSchema,
      },
    },
    handler: async (request, reply) => {
      try {
        const baby = await createBabyUseCase.execute({
          userId: request.userId,
          name: request.body.name,
          birthDate: toBirthDate(request.body.birthDate),
          gender: request.body.gender,
          bloodType: request.body.bloodType,
          allergies: request.body.allergies,
          avatarUrl: request.body.avatarUrl,
        });

        return reply.status(201).send(toResponse(baby));
      } catch (error) {
        if (error instanceof DomainError) {
          return reply.status(400).send({ status: 'error', message: error.message });
        }

        throw error;
      }
    },
  });

  app.route({
    method: 'GET',
    url: '/babies',
    preHandler: authenticate,
    schema: {
      tags: ['Babies'],
      summary: "List the authenticated user's baby profiles",
      response: {
        200: babyListResponseSchema,
        401: authErrorResponseSchema,
        500: authErrorResponseSchema,
      },
    },
    handler: async (request, reply) => {
      const babies = await listUserBabiesUseCase.execute(request.userId);
      return reply.status(200).send(babies.map(toResponse));
    },
  });

  app.route({
    method: 'GET',
    url: '/babies/:babyId',
    preHandler: authenticate,
    schema: {
      tags: ['Babies'],
      summary: 'Get a baby profile by id',
      params: babyParamsSchema,
      response: {
        200: babyResponseSchema,
        401: authErrorResponseSchema,
        404: authErrorResponseSchema,
        500: authErrorResponseSchema,
      },
    },
    handler: async (request, reply) => {
      try {
        const baby = await getBabyByIdUseCase.execute({
          babyId: request.params.babyId,
          requestingUserId: request.userId,
        });

        return reply.status(200).send(toResponse(baby));
      } catch (error) {
        if (error instanceof BabyNotFoundError) {
          return reply.status(404).send({ status: 'error', message: error.message });
        }

        throw error;
      }
    },
  });

  app.route({
    method: 'PATCH',
    url: '/babies/:babyId',
    preHandler: authenticate,
    schema: {
      tags: ['Babies'],
      summary: 'Update a baby profile',
      params: babyParamsSchema,
      body: updateBabyBodySchema,
      response: {
        200: babyResponseSchema,
        400: authErrorResponseSchema,
        401: authErrorResponseSchema,
        404: authErrorResponseSchema,
        500: authErrorResponseSchema,
      },
    },
    handler: async (request, reply) => {
      try {
        const baby = await updateBabyUseCase.execute({
          babyId: request.params.babyId,
          requestingUserId: request.userId,
          name: request.body.name,
          birthDate: request.body.birthDate ? toBirthDate(request.body.birthDate) : undefined,
          gender: request.body.gender,
          bloodType: request.body.bloodType,
          allergies: request.body.allergies,
          avatarUrl: request.body.avatarUrl,
        });

        return reply.status(200).send(toResponse(baby));
      } catch (error) {
        if (error instanceof BabyNotFoundError) {
          return reply.status(404).send({ status: 'error', message: error.message });
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
    url: '/babies/:babyId',
    preHandler: authenticate,
    schema: {
      tags: ['Babies'],
      summary: 'Delete a baby profile',
      description:
        'Deletes a baby profile owned by the authenticated user, cascading to its vaccine records, ' +
        'appointments, milestones and notifications.',
      params: babyParamsSchema,
      response: {
        204: z.null().describe('Baby profile deleted successfully'),
        401: authErrorResponseSchema,
        404: authErrorResponseSchema,
        500: authErrorResponseSchema,
      },
    },
    handler: async (request, reply) => {
      try {
        await deleteBabyUseCase.execute({
          babyId: request.params.babyId,
          requestingUserId: request.userId,
        });

        return reply.status(204).send(null);
      } catch (error) {
        if (error instanceof BabyNotFoundError) {
          return reply.status(404).send({ status: 'error', message: error.message });
        }

        throw error;
      }
    },
  });
}
