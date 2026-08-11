import type { App } from '../../../infrastructure/http/build-app';
import { Milestone } from '../../../domain/milestone/milestone';
import { z } from 'zod';
import { CreateMilestoneUseCase } from '../../../application/milestone/create-milestone.use-case';
import { ListBabyMilestonesUseCase } from '../../../application/milestone/list-baby-milestones.use-case';
import { GetMilestoneByIdUseCase } from '../../../application/milestone/get-milestone-by-id.use-case';
import { UpdateMilestoneUseCase } from '../../../application/milestone/update-milestone.use-case';
import { DeleteMilestoneUseCase } from '../../../application/milestone/delete-milestone.use-case';
import { MilestoneNotFoundError } from '../../../application/milestone/errors/milestone-not-found.error';
import { BabyNotFoundError } from '../../../application/baby/errors/baby-not-found.error';
import { DomainError } from '../../../shared/errors/domain-error';
import { PrismaBabyRepository } from '../../../infrastructure/database/repositories/prisma-baby.repository';
import { PrismaBabyGuardianRepository } from '../../../infrastructure/database/repositories/prisma-baby-guardian.repository';
import { PrismaMilestoneRepository } from '../../../infrastructure/database/repositories/prisma-milestone.repository';
import { prisma } from '../../../infrastructure/database/prisma-client';
import { auditLogger } from '../../../infrastructure/audit/audit-logger.instance';
import { authenticate } from '../plugins/authenticate';
import { authErrorResponseSchema } from '../schemas/auth.schema';
import {
  createMilestoneBodySchema,
  milestoneIdParamsSchema,
  milestoneListQuerystringSchema,
  milestoneListResponseSchema,
  milestoneParamsSchema,
  milestoneResponseSchema,
  updateMilestoneBodySchema,
} from '../schemas/milestone.schema';

function toBirthDate(dateOnly: string): Date {
  return new Date(`${dateOnly}T00:00:00.000Z`);
}

function toResponse(milestone: Milestone) {
  return {
    id: milestone.id,
    babyId: milestone.babyId,
    title: milestone.title,
    description: milestone.description,
    achievedAt: milestone.achievedAt.toISOString().slice(0, 10),
    category: milestone.category,
    photoUrl: milestone.photoUrl,
    createdAt: milestone.createdAt.toISOString(),
  };
}

export async function milestoneRoutes(app: App) {
  const babyRepository = new PrismaBabyRepository(prisma);
  const babyGuardianRepository = new PrismaBabyGuardianRepository(prisma);
  const milestoneRepository = new PrismaMilestoneRepository(prisma);
  const createMilestoneUseCase = new CreateMilestoneUseCase(babyRepository, babyGuardianRepository, milestoneRepository);
  const listBabyMilestonesUseCase = new ListBabyMilestonesUseCase(babyRepository, babyGuardianRepository, milestoneRepository);
  const getMilestoneByIdUseCase = new GetMilestoneByIdUseCase(babyRepository, babyGuardianRepository, milestoneRepository);
  const updateMilestoneUseCase = new UpdateMilestoneUseCase(babyRepository, babyGuardianRepository, milestoneRepository);
  const deleteMilestoneUseCase = new DeleteMilestoneUseCase(babyRepository, babyGuardianRepository, milestoneRepository);

  app.route({
    method: 'POST',
    url: '/babies/:babyId/milestones',
    preHandler: authenticate,
    schema: {
      tags: ['Milestones'],
      summary: 'Record a developmental milestone',
      description:
        "Creates a new milestone for the baby. The achieved date cannot be in the future or before the baby's " +
        'birth date.',
      params: milestoneParamsSchema,
      body: createMilestoneBodySchema,
      response: {
        201: milestoneResponseSchema,
        400: authErrorResponseSchema,
        401: authErrorResponseSchema,
        404: authErrorResponseSchema,
        500: authErrorResponseSchema,
      },
    },
    handler: async (request, reply) => {
      try {
        const milestone = await createMilestoneUseCase.execute({
          babyId: request.params.babyId,
          requestingUserId: request.userId,
          title: request.body.title,
          description: request.body.description,
          achievedAt: toBirthDate(request.body.achievedAt),
          category: request.body.category,
          photoUrl: request.body.photoUrl,
        });

        auditLogger.log({
          userId: request.userId,
          action: 'milestone.create',
          resourceType: 'Milestone',
          resourceId: milestone.id,
          babyId: milestone.babyId,
        });

        return reply.status(201).send(toResponse(milestone));
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
    url: '/babies/:babyId/milestones',
    preHandler: authenticate,
    schema: {
      tags: ['Milestones'],
      summary: "List a baby's developmental milestones",
      description: 'Optionally filtered by `search`, matched case-insensitively against title or description.',
      params: milestoneParamsSchema,
      querystring: milestoneListQuerystringSchema,
      response: {
        200: milestoneListResponseSchema,
        401: authErrorResponseSchema,
        404: authErrorResponseSchema,
        500: authErrorResponseSchema,
      },
    },
    handler: async (request, reply) => {
      try {
        const milestones = await listBabyMilestonesUseCase.execute({
          babyId: request.params.babyId,
          requestingUserId: request.userId,
          search: request.query.search,
        });

        return reply.status(200).send(milestones.map(toResponse));
      } catch (error) {
        if (error instanceof BabyNotFoundError) {
          return reply.status(404).send({ status: 'error', message: error.message });
        }

        throw error;
      }
    },
  });

  app.route({
    method: 'GET',
    url: '/babies/:babyId/milestones/:milestoneId',
    preHandler: authenticate,
    schema: {
      tags: ['Milestones'],
      summary: 'Get a milestone by id',
      params: milestoneIdParamsSchema,
      response: {
        200: milestoneResponseSchema,
        401: authErrorResponseSchema,
        404: authErrorResponseSchema,
        500: authErrorResponseSchema,
      },
    },
    handler: async (request, reply) => {
      try {
        const milestone = await getMilestoneByIdUseCase.execute({
          babyId: request.params.babyId,
          milestoneId: request.params.milestoneId,
          requestingUserId: request.userId,
        });

        return reply.status(200).send(toResponse(milestone));
      } catch (error) {
        if (error instanceof BabyNotFoundError || error instanceof MilestoneNotFoundError) {
          return reply.status(404).send({ status: 'error', message: error.message });
        }

        throw error;
      }
    },
  });

  app.route({
    method: 'PATCH',
    url: '/babies/:babyId/milestones/:milestoneId',
    preHandler: authenticate,
    schema: {
      tags: ['Milestones'],
      summary: 'Update a milestone',
      params: milestoneIdParamsSchema,
      body: updateMilestoneBodySchema,
      response: {
        200: milestoneResponseSchema,
        400: authErrorResponseSchema,
        401: authErrorResponseSchema,
        404: authErrorResponseSchema,
        500: authErrorResponseSchema,
      },
    },
    handler: async (request, reply) => {
      try {
        const milestone = await updateMilestoneUseCase.execute({
          babyId: request.params.babyId,
          milestoneId: request.params.milestoneId,
          requestingUserId: request.userId,
          title: request.body.title,
          description: request.body.description,
          achievedAt: request.body.achievedAt ? toBirthDate(request.body.achievedAt) : undefined,
          category: request.body.category,
          photoUrl: request.body.photoUrl,
        });

        auditLogger.log({
          userId: request.userId,
          action: 'milestone.update',
          resourceType: 'Milestone',
          resourceId: milestone.id,
          babyId: milestone.babyId,
        });

        return reply.status(200).send(toResponse(milestone));
      } catch (error) {
        if (error instanceof BabyNotFoundError || error instanceof MilestoneNotFoundError) {
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
    url: '/babies/:babyId/milestones/:milestoneId',
    preHandler: authenticate,
    schema: {
      tags: ['Milestones'],
      summary: 'Delete a milestone',
      params: milestoneIdParamsSchema,
      response: {
        204: z.null().describe('Milestone deleted successfully'),
        401: authErrorResponseSchema,
        404: authErrorResponseSchema,
        500: authErrorResponseSchema,
      },
    },
    handler: async (request, reply) => {
      try {
        await deleteMilestoneUseCase.execute({
          babyId: request.params.babyId,
          milestoneId: request.params.milestoneId,
          requestingUserId: request.userId,
        });

        auditLogger.log({
          userId: request.userId,
          action: 'milestone.delete',
          resourceType: 'Milestone',
          resourceId: request.params.milestoneId,
          babyId: request.params.babyId,
        });

        return reply.status(204).send(null);
      } catch (error) {
        if (error instanceof BabyNotFoundError || error instanceof MilestoneNotFoundError) {
          return reply.status(404).send({ status: 'error', message: error.message });
        }

        throw error;
      }
    },
  });
}
