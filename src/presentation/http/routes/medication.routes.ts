import { z } from 'zod';
import type { App } from '../../../infrastructure/http/build-app';
import { Medication } from '../../../domain/medication/medication';
import { CreateMedicationUseCase } from '../../../application/medication/create-medication.use-case';
import { ListBabyMedicationsUseCase } from '../../../application/medication/list-baby-medications.use-case';
import { UpdateMedicationUseCase } from '../../../application/medication/update-medication.use-case';
import { DeleteMedicationUseCase } from '../../../application/medication/delete-medication.use-case';
import { MedicationNotFoundError } from '../../../application/medication/errors/medication-not-found.error';
import { BabyNotFoundError } from '../../../application/baby/errors/baby-not-found.error';
import { DomainError } from '../../../shared/errors/domain-error';
import { PrismaBabyRepository } from '../../../infrastructure/database/repositories/prisma-baby.repository';
import { PrismaBabyGuardianRepository } from '../../../infrastructure/database/repositories/prisma-baby-guardian.repository';
import { PrismaMedicationRepository } from '../../../infrastructure/database/repositories/prisma-medication.repository';
import { prisma } from '../../../infrastructure/database/prisma-client';
import { auditLogger } from '../../../infrastructure/audit/audit-logger.instance';
import { authenticate } from '../plugins/authenticate';
import { authErrorResponseSchema } from '../schemas/auth.schema';
import {
  createMedicationBodySchema,
  medicationIdParamsSchema,
  medicationListResponseSchema,
  medicationParamsSchema,
  medicationResponseSchema,
  updateMedicationBodySchema,
} from '../schemas/medication.schema';

function toDate(dateOnly: string): Date {
  return new Date(`${dateOnly}T00:00:00.000Z`);
}

function toDateOnly(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function toResponse(medication: Medication) {
  return {
    id: medication.id,
    babyId: medication.babyId,
    name: medication.name,
    dosage: medication.dosage,
    frequency: medication.frequency,
    reason: medication.reason,
    prescriberName: medication.prescriberName,
    startedOn: toDateOnly(medication.startedOn),
    endedOn: medication.endedOn ? toDateOnly(medication.endedOn) : null,
    notes: medication.notes,
    createdAt: medication.createdAt.toISOString(),
  };
}

export async function medicationRoutes(app: App) {
  const babyRepository = new PrismaBabyRepository(prisma);
  const babyGuardianRepository = new PrismaBabyGuardianRepository(prisma);
  const medicationRepository = new PrismaMedicationRepository(prisma);
  const createMedicationUseCase = new CreateMedicationUseCase(babyRepository, babyGuardianRepository, medicationRepository);
  const listBabyMedicationsUseCase = new ListBabyMedicationsUseCase(babyRepository, babyGuardianRepository, medicationRepository);
  const updateMedicationUseCase = new UpdateMedicationUseCase(babyRepository, babyGuardianRepository, medicationRepository);
  const deleteMedicationUseCase = new DeleteMedicationUseCase(babyRepository, babyGuardianRepository, medicationRepository);

  app.route({
    method: 'POST',
    url: '/babies/:babyId/medications',
    preHandler: authenticate,
    schema: {
      tags: ['Medications'],
      summary: 'Record a medication this baby was prescribed',
      description:
        'A record of what was prescribed, never advice. Dose and frequency are stored as written, and nothing ' +
        'here schedules or reminds: `startedOn` and `endedOn` describe what a course covered.',
      params: medicationParamsSchema,
      body: createMedicationBodySchema,
      response: {
        201: medicationResponseSchema,
        400: authErrorResponseSchema,
        401: authErrorResponseSchema,
        404: authErrorResponseSchema,
        500: authErrorResponseSchema,
      },
    },
    handler: async (request, reply) => {
      try {
        const medication = await createMedicationUseCase.execute({
          babyId: request.params.babyId,
          requestingUserId: request.userId,
          name: request.body.name,
          startedOn: toDate(request.body.startedOn),
          dosage: request.body.dosage,
          frequency: request.body.frequency,
          reason: request.body.reason,
          prescriberName: request.body.prescriberName,
          endedOn: request.body.endedOn ? toDate(request.body.endedOn) : null,
          notes: request.body.notes,
        });

        auditLogger.log({
          userId: request.userId,
          action: 'medication.create',
          resourceType: 'Medication',
          resourceId: medication.id,
          babyId: medication.babyId,
        });

        return reply.status(201).send(toResponse(medication));
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
    url: '/babies/:babyId/medications',
    preHandler: authenticate,
    schema: {
      tags: ['Medications'],
      summary: "List a baby's medications",
      description: 'Most recently started first. A course with no `endedOn` has no recorded end.',
      params: medicationParamsSchema,
      response: {
        200: medicationListResponseSchema,
        401: authErrorResponseSchema,
        404: authErrorResponseSchema,
        500: authErrorResponseSchema,
      },
    },
    handler: async (request, reply) => {
      try {
        const medications = await listBabyMedicationsUseCase.execute({
          babyId: request.params.babyId,
          requestingUserId: request.userId,
        });

        return reply.status(200).send(medications.map(toResponse));
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
    url: '/babies/:babyId/medications/:medicationId',
    preHandler: authenticate,
    schema: {
      tags: ['Medications'],
      summary: 'Update a medication, most often to end the course',
      params: medicationIdParamsSchema,
      body: updateMedicationBodySchema,
      response: {
        200: medicationResponseSchema,
        400: authErrorResponseSchema,
        401: authErrorResponseSchema,
        404: authErrorResponseSchema,
        500: authErrorResponseSchema,
      },
    },
    handler: async (request, reply) => {
      try {
        const medication = await updateMedicationUseCase.execute({
          babyId: request.params.babyId,
          medicationId: request.params.medicationId,
          requestingUserId: request.userId,
          name: request.body.name,
          startedOn: request.body.startedOn ? toDate(request.body.startedOn) : undefined,
          dosage: request.body.dosage,
          frequency: request.body.frequency,
          reason: request.body.reason,
          prescriberName: request.body.prescriberName,
          // Three states, and they are all meaningful: a date ends the course, `null` reopens it,
          // and an absent key leaves it as it was.
          endedOn:
            request.body.endedOn === undefined ? undefined : request.body.endedOn ? toDate(request.body.endedOn) : null,
          notes: request.body.notes,
        });

        auditLogger.log({
          userId: request.userId,
          action: 'medication.update',
          resourceType: 'Medication',
          resourceId: medication.id,
          babyId: medication.babyId,
        });

        return reply.status(200).send(toResponse(medication));
      } catch (error) {
        if (error instanceof BabyNotFoundError || error instanceof MedicationNotFoundError) {
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
    url: '/babies/:babyId/medications/:medicationId',
    preHandler: authenticate,
    schema: {
      tags: ['Medications'],
      summary: 'Delete a medication record',
      description: 'For an entry that should not exist — usually one entered by mistake.',
      params: medicationIdParamsSchema,
      response: {
        204: z.null().describe('Medication deleted successfully'),
        401: authErrorResponseSchema,
        404: authErrorResponseSchema,
        500: authErrorResponseSchema,
      },
    },
    handler: async (request, reply) => {
      try {
        await deleteMedicationUseCase.execute({
          babyId: request.params.babyId,
          medicationId: request.params.medicationId,
          requestingUserId: request.userId,
        });

        auditLogger.log({
          userId: request.userId,
          action: 'medication.delete',
          resourceType: 'Medication',
          resourceId: request.params.medicationId,
          babyId: request.params.babyId,
        });

        return reply.status(204).send(null);
      } catch (error) {
        if (error instanceof BabyNotFoundError || error instanceof MedicationNotFoundError) {
          return reply.status(404).send({ status: 'error', message: error.message });
        }

        throw error;
      }
    },
  });
}
