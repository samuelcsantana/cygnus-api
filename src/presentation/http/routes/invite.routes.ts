import { z } from 'zod';
import type { App } from '../../../infrastructure/http/build-app';
import { CreateBabyInviteUseCase } from '../../../application/invite/create-baby-invite.use-case';
import { GetInviteByCodeUseCase } from '../../../application/invite/get-invite-by-code.use-case';
import { RedeemInviteUseCase } from '../../../application/invite/redeem-invite.use-case';
import { ListBabyGuardiansUseCase } from '../../../application/baby/list-baby-guardians.use-case';
import { RemoveBabyGuardianUseCase } from '../../../application/baby/remove-baby-guardian.use-case';
import { BabyNotFoundError } from '../../../application/baby/errors/baby-not-found.error';
import { GuardianNotFoundError } from '../../../application/baby/errors/guardian-not-found.error';
import { CannotRemoveOwnerError } from '../../../application/baby/errors/cannot-remove-owner.error';
import { GuardianForbiddenError } from '../../../application/baby/errors/guardian-forbidden.error';
import { InviteNotFoundError } from '../../../application/invite/errors/invite-not-found.error';
import { InviteNoLongerValidError } from '../../../application/invite/errors/invite-no-longer-valid.error';
import { AlreadyGuardianError } from '../../../application/invite/errors/already-guardian.error';
import { DomainError } from '../../../shared/errors/domain-error';
import { PrismaBabyRepository } from '../../../infrastructure/database/repositories/prisma-baby.repository';
import { PrismaBabyGuardianRepository } from '../../../infrastructure/database/repositories/prisma-baby-guardian.repository';
import { PrismaBabyInviteRepository } from '../../../infrastructure/database/repositories/prisma-baby-invite.repository';
import { PrismaUserRepository } from '../../../infrastructure/database/repositories/prisma-user.repository';
import { prisma } from '../../../infrastructure/database/prisma-client';
import { emailService } from '../../../infrastructure/email/email-service.instance';
import { auditLogger } from '../../../infrastructure/audit/audit-logger.instance';
import { env } from '../../../shared/config/env';
import { authenticate } from '../plugins/authenticate';
import { authErrorResponseSchema } from '../schemas/auth.schema';
import {
  createInviteBodySchema,
  createInviteResponseSchema,
  guardianListResponseSchema,
  guardianParamsSchema,
  inviteBabyParamsSchema,
  inviteCodeParamsSchema,
  invitePreviewResponseSchema,
  redeemInviteResponseSchema,
} from '../schemas/invite.schema';

export async function inviteRoutes(app: App) {
  const babyRepository = new PrismaBabyRepository(prisma);
  const babyGuardianRepository = new PrismaBabyGuardianRepository(prisma);
  const babyInviteRepository = new PrismaBabyInviteRepository(prisma);
  const userRepository = new PrismaUserRepository(prisma);

  const createBabyInviteUseCase = new CreateBabyInviteUseCase(babyRepository, babyGuardianRepository, babyInviteRepository);
  const getInviteByCodeUseCase = new GetInviteByCodeUseCase(babyRepository, babyInviteRepository);
  const redeemInviteUseCase = new RedeemInviteUseCase(babyRepository, babyGuardianRepository, babyInviteRepository);
  const listBabyGuardiansUseCase = new ListBabyGuardiansUseCase(babyRepository, babyGuardianRepository, userRepository);
  const removeBabyGuardianUseCase = new RemoveBabyGuardianUseCase(babyRepository, babyGuardianRepository);

  app.route({
    method: 'POST',
    url: '/babies/:babyId/invites',
    preHandler: authenticate,
    schema: {
      tags: ['Guardians'],
      summary: 'Create a guardian invite for a baby',
      description:
        'Generates a shareable, single-use invite code that grants GUARDIAN access to the baby once redeemed. ' +
        'The requester must already be a guardian (any role) of the baby. If inviteeEmail is provided, an ' +
        'invite email is sent best-effort — delivery failure never fails the request, since the code/link ' +
        'still works if shared manually.',
      params: inviteBabyParamsSchema,
      body: createInviteBodySchema,
      response: {
        201: createInviteResponseSchema,
        400: authErrorResponseSchema,
        401: authErrorResponseSchema,
        404: authErrorResponseSchema,
        500: authErrorResponseSchema,
      },
    },
    handler: async (request, reply) => {
      try {
        const invite = await createBabyInviteUseCase.execute({
          babyId: request.params.babyId,
          requestingUserId: request.userId,
          inviteeEmail: request.body.inviteeEmail,
        });

        auditLogger.log({
          userId: request.userId,
          action: 'invite.create',
          resourceType: 'BabyInvite',
          resourceId: invite.id,
          babyId: invite.babyId,
        });

        if (request.body.inviteeEmail) {
          const [baby, inviter] = await Promise.all([
            babyRepository.findById(invite.babyId),
            userRepository.findById(request.userId),
          ]);

          if (baby && inviter) {
            const inviteUrl = `${env.CORS_ORIGIN}/invites/${invite.code}`;

            emailService.sendGuardianInviteEmail(request.body.inviteeEmail, inviter.name, baby.name, inviteUrl).catch((error: unknown) => {
              request.log.warn({ err: error }, 'invite.email_send_failed');
            });
          }
        }

        return reply.status(201).send({
          code: invite.code,
          expiresAt: invite.expiresAt.toISOString(),
        });
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
    url: '/invites/:code',
    schema: {
      tags: ['Guardians'],
      summary: 'Preview an invite by its code',
      description:
        'Public endpoint (no authentication required) so the frontend can show baby name/avatar before the ' +
        'user logs in. Always returns 200, even for an expired or already-used invite, so the caller can ' +
        'render a clear "no longer valid" message instead of a generic error.',
      params: inviteCodeParamsSchema,
      response: {
        200: invitePreviewResponseSchema,
        404: authErrorResponseSchema,
        500: authErrorResponseSchema,
      },
    },
    handler: async (request, reply) => {
      try {
        const preview = await getInviteByCodeUseCase.execute(request.params.code);

        return reply.status(200).send(preview);
      } catch (error) {
        if (error instanceof InviteNotFoundError) {
          return reply.status(404).send({ status: 'error', message: error.message });
        }

        throw error;
      }
    },
  });

  app.route({
    method: 'POST',
    url: '/invites/:code/redeem',
    preHandler: authenticate,
    schema: {
      tags: ['Guardians'],
      summary: 'Redeem an invite code',
      description:
        'Grants the authenticated user GUARDIAN access to the invite\'s baby. 410 if the invite is expired or ' +
        'already used, 409 if the requester is already a guardian of the baby.',
      params: inviteCodeParamsSchema,
      response: {
        200: redeemInviteResponseSchema,
        401: authErrorResponseSchema,
        404: authErrorResponseSchema,
        409: authErrorResponseSchema,
        410: authErrorResponseSchema,
        500: authErrorResponseSchema,
      },
    },
    handler: async (request, reply) => {
      try {
        const result = await redeemInviteUseCase.execute({
          code: request.params.code,
          requestingUserId: request.userId,
        });

        auditLogger.log({
          userId: request.userId,
          action: 'invite.redeem',
          resourceType: 'BabyGuardian',
          resourceId: request.userId,
          babyId: result.babyId,
        });

        return reply.status(200).send(result);
      } catch (error) {
        if (error instanceof InviteNotFoundError) {
          return reply.status(404).send({ status: 'error', message: error.message });
        }

        if (error instanceof InviteNoLongerValidError) {
          return reply.status(410).send({ status: 'error', message: error.message });
        }

        if (error instanceof AlreadyGuardianError) {
          return reply.status(409).send({ status: 'error', message: error.message });
        }

        throw error;
      }
    },
  });

  app.route({
    method: 'GET',
    url: '/babies/:babyId/guardians',
    preHandler: authenticate,
    schema: {
      tags: ['Guardians'],
      summary: "List a baby's guardians",
      description: 'Returns every adult with access to the baby (the OWNER and any GUARDIANs), newest last.',
      params: inviteBabyParamsSchema,
      response: {
        200: guardianListResponseSchema,
        401: authErrorResponseSchema,
        404: authErrorResponseSchema,
        500: authErrorResponseSchema,
      },
    },
    handler: async (request, reply) => {
      try {
        const guardians = await listBabyGuardiansUseCase.execute({
          babyId: request.params.babyId,
          requestingUserId: request.userId,
        });

        return reply.status(200).send(
          guardians.map((guardian) => ({
            userId: guardian.userId,
            name: guardian.name,
            email: guardian.email,
            role: guardian.role,
            joinedAt: guardian.joinedAt.toISOString(),
          })),
        );
      } catch (error) {
        if (error instanceof BabyNotFoundError) {
          return reply.status(404).send({ status: 'error', message: error.message });
        }

        throw error;
      }
    },
  });

  app.route({
    method: 'DELETE',
    url: '/babies/:babyId/guardians/:userId',
    preHandler: authenticate,
    schema: {
      tags: ['Guardians'],
      summary: 'Remove a guardian from a baby',
      description:
        'Removes a GUARDIAN from the baby — either the guardian removing themselves ("leave"), or the OWNER ' +
        'removing someone else. The OWNER guardian row itself can never be removed this way (400).',
      params: guardianParamsSchema,
      response: {
        204: z.null().describe('Guardian removed successfully'),
        400: authErrorResponseSchema,
        401: authErrorResponseSchema,
        403: authErrorResponseSchema,
        404: authErrorResponseSchema,
        500: authErrorResponseSchema,
      },
    },
    handler: async (request, reply) => {
      try {
        await removeBabyGuardianUseCase.execute({
          babyId: request.params.babyId,
          targetUserId: request.params.userId,
          requestingUserId: request.userId,
        });

        auditLogger.log({
          userId: request.userId,
          action: 'guardian.remove',
          resourceType: 'BabyGuardian',
          resourceId: request.params.userId,
          babyId: request.params.babyId,
        });

        return reply.status(204).send(null);
      } catch (error) {
        if (error instanceof BabyNotFoundError || error instanceof GuardianNotFoundError) {
          return reply.status(404).send({ status: 'error', message: error.message });
        }

        if (error instanceof CannotRemoveOwnerError) {
          return reply.status(400).send({ status: 'error', message: error.message });
        }

        if (error instanceof GuardianForbiddenError) {
          return reply.status(403).send({ status: 'error', message: error.message });
        }

        throw error;
      }
    },
  });
}
