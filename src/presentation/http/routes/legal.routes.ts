import type { App } from '../../../infrastructure/http/build-app';
import { LegalAcceptance } from '../../../domain/legal/legal-acceptance';
import { ListLegalAcceptancesUseCase } from '../../../application/legal/list-legal-acceptances.use-case';
import { RecordLegalAcceptanceUseCase } from '../../../application/legal/record-legal-acceptance.use-case';
import { PrismaLegalAcceptanceRepository } from '../../../infrastructure/database/repositories/prisma-legal-acceptance.repository';
import { prisma } from '../../../infrastructure/database/prisma-client';
import { auditLogger } from '../../../infrastructure/audit/audit-logger.instance';
import { authenticate } from '../plugins/authenticate';
import { authErrorResponseSchema } from '../schemas/auth.schema';
import {
  legalAcceptanceListResponseSchema,
  legalAcceptanceResponseSchema,
  recordLegalAcceptanceBodySchema,
} from '../schemas/legal.schema';

function toResponse(acceptance: LegalAcceptance) {
  return {
    documentId: acceptance.documentId,
    version: acceptance.version,
    acceptedAt: acceptance.acceptedAt.toISOString(),
  };
}

export async function legalRoutes(app: App) {
  const legalAcceptanceRepository = new PrismaLegalAcceptanceRepository(prisma);
  const listLegalAcceptancesUseCase = new ListLegalAcceptancesUseCase(legalAcceptanceRepository);
  const recordLegalAcceptanceUseCase = new RecordLegalAcceptanceUseCase(legalAcceptanceRepository);

  app.route({
    method: 'GET',
    url: '/legal/acceptances',
    preHandler: authenticate,
    schema: {
      tags: ['Legal'],
      summary: "List the documents the authenticated user has accepted",
      description:
        'Every (document, version) pair the user has accepted, newest first. The caller compares ' +
        'these against the versions currently in force and asks again for whichever differ.',
      response: {
        200: legalAcceptanceListResponseSchema,
        401: authErrorResponseSchema,
        500: authErrorResponseSchema,
      },
    },
    handler: async (request, reply) => {
      const acceptances = await listLegalAcceptancesUseCase.execute(request.userId);

      return reply.status(200).send(acceptances.map(toResponse));
    },
  });

  app.route({
    method: 'POST',
    url: '/legal/acceptances',
    preHandler: authenticate,
    schema: {
      tags: ['Legal'],
      summary: 'Record that the user accepted a version of a document',
      description:
        'Answers 200, not 201, and is idempotent: accepting a version already accepted returns the ' +
        'original record with its original timestamp. A repeated POST is what a double-tap or a ' +
        'retried request looks like, and moving the timestamp would rewrite when consent was given.',
      body: recordLegalAcceptanceBodySchema,
      response: {
        200: legalAcceptanceResponseSchema,
        400: authErrorResponseSchema,
        401: authErrorResponseSchema,
        500: authErrorResponseSchema,
      },
    },
    handler: async (request, reply) => {
      const acceptance = await recordLegalAcceptanceUseCase.execute({
        userId: request.userId,
        documentId: request.body.documentId,
        version: request.body.version,
      });

      auditLogger.log({
        userId: request.userId,
        action: 'legal.accept',
        resourceType: 'LegalAcceptance',
        resourceId: acceptance.id,
      });

      return reply.status(200).send(toResponse(acceptance));
    },
  });
}
