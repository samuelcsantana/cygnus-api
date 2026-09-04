import { z } from 'zod';
import type { App } from '../../../infrastructure/http/build-app';
import { Specialist } from '../../../domain/specialist/specialist';
import { CreateSpecialistUseCase } from '../../../application/specialist/create-specialist.use-case';
import { ListVisibleSpecialistsUseCase } from '../../../application/specialist/list-visible-specialists.use-case';
import { UpdateSpecialistUseCase } from '../../../application/specialist/update-specialist.use-case';
import { DeleteSpecialistUseCase } from '../../../application/specialist/delete-specialist.use-case';
import { SpecialistNotFoundError } from '../../../application/specialist/errors/specialist-not-found.error';
import { DomainError } from '../../../shared/errors/domain-error';
import { PrismaBabyGuardianRepository } from '../../../infrastructure/database/repositories/prisma-baby-guardian.repository';
import { PrismaSpecialistRepository } from '../../../infrastructure/database/repositories/prisma-specialist.repository';
import { prisma } from '../../../infrastructure/database/prisma-client';
import { auditLogger } from '../../../infrastructure/audit/audit-logger.instance';
import { authenticate } from '../plugins/authenticate';
import { authErrorResponseSchema } from '../schemas/auth.schema';
import {
  createSpecialistBodySchema,
  specialistIdOnlyParamsSchema,
  specialistIdParamsSchema,
  specialistListQuerystringSchema,
  specialistListResponseSchema,
  specialistParamsSchema,
  specialistResponseSchema,
  updateSpecialistBodySchema,
} from '../schemas/specialist.schema';

function toResponse(specialist: Specialist) {
  return {
    id: specialist.id,
    userId: specialist.userId,
    name: specialist.name,
    specialty: specialist.specialty,
    phone: specialist.phone,
    babyIds: specialist.babyIds,
    sharedWithUserIds: specialist.sharedWithUserIds,
    // Espelho depreciado — ver o comentário em `specialistResponseSchema`.
    babyId: specialist.babyIds[0] ?? null,
    createdAt: specialist.createdAt.toISOString(),
  };
}

export async function specialistRoutes(app: App) {
  const babyGuardianRepository = new PrismaBabyGuardianRepository(prisma);
  const specialistRepository = new PrismaSpecialistRepository(prisma);
  const createSpecialistUseCase = new CreateSpecialistUseCase(babyGuardianRepository, specialistRepository);
  const listVisibleSpecialistsUseCase = new ListVisibleSpecialistsUseCase(specialistRepository);
  const updateSpecialistUseCase = new UpdateSpecialistUseCase(babyGuardianRepository, specialistRepository);
  const deleteSpecialistUseCase = new DeleteSpecialistUseCase(specialistRepository);

  app.route({
    method: 'POST',
    url: '/specialists',
    preHandler: authenticate,
    schema: {
      tags: ['Specialists'],
      summary: 'Save a professional who looks after this family',
      description:
        'The professional belongs to the account, not to one child. `babyIds` says which children they look ' +
        'after — none is valid, and makes it a private entry. Visibility is the union of three sources: you ' +
        'created it, it is linked to a child the reader can access, or it was shared with them by name.',
      body: createSpecialistBodySchema,
      response: {
        201: specialistResponseSchema,
        400: authErrorResponseSchema,
        401: authErrorResponseSchema,
        500: authErrorResponseSchema,
      },
    },
    handler: async (request, reply) => {
      try {
        const specialist = await createSpecialistUseCase.execute({
          requestingUserId: request.userId,
          name: request.body.name,
          specialty: request.body.specialty,
          phone: request.body.phone,
          babyIds: request.body.babyIds,
          sharedWithUserIds: request.body.sharedWithUserIds,
        });

        auditLogger.log({
          userId: request.userId,
          action: 'specialist.create',
          resourceType: 'Specialist',
          resourceId: specialist.id,
        });

        return reply.status(201).send(toResponse(specialist));
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
    url: '/specialists',
    preHandler: authenticate,
    schema: {
      tags: ['Specialists'],
      summary: 'List the professionals this account can see',
      description: 'Ordered by name. `babyId` narrows the list to one child without widening what is visible.',
      querystring: specialistListQuerystringSchema,
      response: {
        200: specialistListResponseSchema,
        401: authErrorResponseSchema,
        500: authErrorResponseSchema,
      },
    },
    handler: async (request, reply) => {
      const specialists = await listVisibleSpecialistsUseCase.execute({
        requestingUserId: request.userId,
        babyId: request.query.babyId,
      });

      return reply.status(200).send(specialists.map(toResponse));
    },
  });

  app.route({
    method: 'PATCH',
    url: '/specialists/:specialistId',
    preHandler: authenticate,
    schema: {
      tags: ['Specialists'],
      summary: 'Update a professional',
      description: 'Only whoever created it. Seeing an entry does not make it yours to rewrite.',
      params: specialistIdOnlyParamsSchema,
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
          specialistId: request.params.specialistId,
          requestingUserId: request.userId,
          name: request.body.name,
          specialty: request.body.specialty,
          phone: request.body.phone,
          babyIds: request.body.babyIds,
          sharedWithUserIds: request.body.sharedWithUserIds,
        });

        auditLogger.log({
          userId: request.userId,
          action: 'specialist.update',
          resourceType: 'Specialist',
          resourceId: specialist.id,
        });

        return reply.status(200).send(toResponse(specialist));
      } catch (error) {
        if (error instanceof SpecialistNotFoundError) {
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
    url: '/specialists/:specialistId',
    preHandler: authenticate,
    schema: {
      tags: ['Specialists'],
      summary: 'Remove a professional from the list',
      description:
        'Edits the address book and nothing else. Appointments this professional attended keep their ' +
        '`doctorName` — the name as written on the day — and only lose the `specialistId` link.',
      params: specialistIdOnlyParamsSchema,
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
          specialistId: request.params.specialistId,
          requestingUserId: request.userId,
        });

        auditLogger.log({
          userId: request.userId,
          action: 'specialist.delete',
          resourceType: 'Specialist',
          resourceId: request.params.specialistId,
        });

        return reply.status(204).send(null);
      } catch (error) {
        if (error instanceof SpecialistNotFoundError) {
          return reply.status(404).send({ status: 'error', message: error.message });
        }

        throw error;
      }
    },
  });

  /**
   * As quatro rotas por criança, mantidas como ponte por uma versão.
   *
   * O front que está em produção fala com elas. Sem isto, a lista de profissionais desaparece da
   * tela de edição da criança no intervalo entre o deploy da API e o do front — e o cadastro de um
   * profissional novo responderia 404. Saem junto com o `babyId` da resposta.
   */
  app.route({
    method: 'GET',
    url: '/babies/:babyId/specialists',
    preHandler: authenticate,
    schema: {
      tags: ['Specialists'],
      summary: '[Deprecated] List the professionals linked to one child',
      deprecated: true,
      params: specialistParamsSchema,
      response: {
        200: specialistListResponseSchema,
        401: authErrorResponseSchema,
        404: authErrorResponseSchema,
        500: authErrorResponseSchema,
      },
    },
    handler: async (request, reply) => {
      const specialists = await listVisibleSpecialistsUseCase.execute({
        requestingUserId: request.userId,
        babyId: request.params.babyId,
      });

      return reply.status(200).send(specialists.map(toResponse));
    },
  });

  app.route({
    method: 'POST',
    url: '/babies/:babyId/specialists',
    preHandler: authenticate,
    schema: {
      tags: ['Specialists'],
      summary: '[Deprecated] Save a professional already linked to one child',
      deprecated: true,
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
          requestingUserId: request.userId,
          name: request.body.name,
          specialty: request.body.specialty,
          phone: request.body.phone,
          babyIds: [request.params.babyId],
        });

        return reply.status(201).send(toResponse(specialist));
      } catch (error) {
        if (error instanceof DomainError) {
          // O caminho antigo respondia 404 quando a criança não era alcançável, e o front lê isso.
          const status = error.message.includes('access') ? 404 : 400;
          return reply.status(status).send({ status: 'error', message: error.message });
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
      summary: '[Deprecated] Update a professional',
      deprecated: true,
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
          specialistId: request.params.specialistId,
          requestingUserId: request.userId,
          name: request.body.name,
          specialty: request.body.specialty,
          phone: request.body.phone,
        });

        return reply.status(200).send(toResponse(specialist));
      } catch (error) {
        if (error instanceof SpecialistNotFoundError) {
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
      summary: '[Deprecated] Remove a professional',
      deprecated: true,
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
          specialistId: request.params.specialistId,
          requestingUserId: request.userId,
        });

        return reply.status(204).send(null);
      } catch (error) {
        if (error instanceof SpecialistNotFoundError) {
          return reply.status(404).send({ status: 'error', message: error.message });
        }

        throw error;
      }
    },
  });
}
