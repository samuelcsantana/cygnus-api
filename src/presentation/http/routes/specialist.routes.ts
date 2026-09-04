import { z } from 'zod';
import type { App } from '../../../infrastructure/http/build-app';
import { Specialist } from '../../../domain/specialist/specialist';
import { CreateSpecialistUseCase } from '../../../application/specialist/create-specialist.use-case';
import { ListBabySpecialistsUseCase } from '../../../application/specialist/list-baby-specialists.use-case';
import { UpdateSpecialistUseCase } from '../../../application/specialist/update-specialist.use-case';
import { DeleteSpecialistUseCase } from '../../../application/specialist/delete-specialist.use-case';
import { SpecialistNotFoundError } from '../../../application/specialist/errors/specialist-not-found.error';
import { BabyNotFoundError } from '../../../application/baby/errors/baby-not-found.error';
import { DomainError } from '../../../shared/errors/domain-error';
import { PrismaBabyRepository } from '../../../infrastructure/database/repositories/prisma-baby.repository';
import { PrismaBabyGuardianRepository } from '../../../infrastructure/database/repositories/prisma-baby-guardian.repository';
import { PrismaSpecialistRepository } from '../../../infrastructure/database/repositories/prisma-specialist.repository';
import { prisma } from '../../../infrastructure/database/prisma-client';
import { auditLogger } from '../../../infrastructure/audit/audit-logger.instance';
import { authenticate } from '../plugins/authenticate';
import { authErrorResponseSchema } from '../schemas/auth.schema';
import {
  createSpecialistBodySchema,
  specialistIdParamsSchema,
  specialistListResponseSchema,
  specialistParamsSchema,
  specialistResponseSchema,
  updateSpecialistBodySchema,
} from '../schemas/specialist.schema';

function toResponse(specialist: Specialist) {
  return {
    id: specialist.id,
    babyId: specialist.babyId,
    name: specialist.name,
    specialty: specialist.specialty,
    phone: specialist.phone,
    createdAt: specialist.createdAt.toISOString(),
  };
}

export async function specialistRoutes(app: App) {
  const babyRepository = new PrismaBabyRepository(prisma);
  const babyGuardianRepository = new PrismaBabyGuardianRepository(prisma);
  const specialistRepository = new PrismaSpecialistRepository(prisma);
  const createSpecialistUseCase = new CreateSpecialistUseCase(babyRepository, babyGuardianRepository, specialistRepository);
  const listBabySpecialistsUseCase = new ListBabySpecialistsUseCase(babyRepository, babyGuardianRepository, specialistRepository);
  const updateSpecialistUseCase = new UpdateSpecialistUseCase(babyRepository, babyGuardianRepository, specialistRepository);
  const deleteSpecialistUseCase = new DeleteSpecialistUseCase(babyRepository, babyGuardianRepository, specialistRepository);

  app.route({
    method: 'POST',
    url: '/babies/:babyId/specialists',
    preHandler: authenticate,
    schema: {
      tags: ['Specialists'],
      summary: 'Save a professional who looks after this baby',
      description:
        'Specialists belong to the baby, not to the account, so whoever has guardian access to the baby sees ' +
        'them. Saving one never changes an appointment: `doctorName` stays as it was typed.',
      params: specialistParamsSchema,
      body: createSpecialistBodySchema,
      response: {
        201: specialistResponseSchema,
        400: authErrorResponseSchema,
        401: authErrorResponseSchema,
        404: authErrorResponseSchema,
        500: authErrorResponseSchema,
      },
    },
    handler: async (request, reply) => {
      try {
        const specialist = await createSpecialistUseCase.execute({
          babyId: request.params.babyId,
          requestingUserId: request.userId,
          name: request.body.name,
          specialty: request.body.specialty,
          phone: request.body.phone,
        });

        auditLogger.log({
          userId: request.userId,
          action: 'specialist.create',
          resourceType: 'Specialist',
          resourceId: specialist.id,
          babyId: specialist.babyId,
        });

        return reply.status(201).send(toResponse(specialist));
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
    method: 'GET',
    url: '/babies/:babyId/specialists',
    preHandler: authenticate,
    schema: {
      tags: ['Specialists'],
      summary: "List the professionals who look after a baby",
      description: 'Ordered by name, which is the order an address book is read in.',
      params: specialistParamsSchema,
      response: {
        200: specialistListResponseSchema,
        401: authErrorResponseSchema,
        404: authErrorResponseSchema,
        500: authErrorResponseSchema,
      },
    },
    handler: async (request, reply) => {
      try {
        const specialists = await listBabySpecialistsUseCase.execute({
          babyId: request.params.babyId,
          requestingUserId: request.userId,
        });

        return reply.status(200).send(specialists.map(toResponse));
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
    url: '/babies/:babyId/specialists/:specialistId',
    preHandler: authenticate,
    schema: {
      tags: ['Specialists'],
      summary: 'Update a professional',
      params: specialistIdParamsSchema,
      body: updateSpecialistBodySchema,
      response: {
        200: specialistResponseSchema,
        400: authErrorResponseSchema,
        401: authErrorResponseSchema,
        404: authErrorResponseSchema,
        500: authErrorResponseSchema,
      },
    },
    handler: async (request, reply) => {
      try {
        const specialist = await updateSpecialistUseCase.execute({
          babyId: request.params.babyId,
          specialistId: request.params.specialistId,
          requestingUserId: request.userId,
          name: request.body.name,
          specialty: request.body.specialty,
          phone: request.body.phone,
        });

        auditLogger.log({
          userId: request.userId,
          action: 'specialist.update',
          resourceType: 'Specialist',
          resourceId: specialist.id,
          babyId: specialist.babyId,
        });

        return reply.status(200).send(toResponse(specialist));
      } catch (error) {
        if (error instanceof BabyNotFoundError || error instanceof SpecialistNotFoundError) {
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
    url: '/babies/:babyId/specialists/:specialistId',
    preHandler: authenticate,
    schema: {
      tags: ['Specialists'],
      summary: 'Remove a professional from the list',
      description:
        'Edits the address book and nothing else. Appointments this professional attended keep their ' +
        '`doctorName` — the name as written on the day — and only lose the `specialistId` link.',
      params: specialistIdParamsSchema,
      response: {
        204: z.null().describe('Specialist removed successfully'),
        401: authErrorResponseSchema,
        404: authErrorResponseSchema,
        500: authErrorResponseSchema,
      },
    },
    handler: async (request, reply) => {
      try {
        await deleteSpecialistUseCase.execute({
          babyId: request.params.babyId,
          specialistId: request.params.specialistId,
          requestingUserId: request.userId,
        });

        auditLogger.log({
          userId: request.userId,
          action: 'specialist.delete',
          resourceType: 'Specialist',
          resourceId: request.params.specialistId,
          babyId: request.params.babyId,
        });

        return reply.status(204).send(null);
      } catch (error) {
        if (error instanceof BabyNotFoundError || error instanceof SpecialistNotFoundError) {
          return reply.status(404).send({ status: 'error', message: error.message });
        }

        throw error;
      }
    },
  });
}
