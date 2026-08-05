import type { App } from '../../../infrastructure/http/build-app';
import { AgeGroupSchedule } from '../../../application/vaccine/get-baby-vaccine-schedule.use-case';
import { GetBabyVaccineScheduleUseCase } from '../../../application/vaccine/get-baby-vaccine-schedule.use-case';
import { MarkVaccineAsAppliedUseCase } from '../../../application/vaccine/mark-vaccine-as-applied.use-case';
import { RegisterAdhocVaccineUseCase } from '../../../application/vaccine/register-adhoc-vaccine.use-case';
import { ListAdhocVaccineRecordsUseCase } from '../../../application/vaccine/list-adhoc-vaccine-records.use-case';
import { BabyNotFoundError } from '../../../application/baby/errors/baby-not-found.error';
import { VaccineNotFoundError } from '../../../application/vaccine/errors/vaccine-not-found.error';
import { DomainError } from '../../../shared/errors/domain-error';
import { BabyVaccineRecord } from '../../../domain/vaccine/baby-vaccine-record';
import { PrismaBabyRepository } from '../../../infrastructure/database/repositories/prisma-baby.repository';
import { PrismaVaccineRepository } from '../../../infrastructure/database/repositories/prisma-vaccine.repository';
import { CachedVaccineRepository } from '../../../infrastructure/database/repositories/cached-vaccine.repository';
import { PrismaBabyVaccineRecordRepository } from '../../../infrastructure/database/repositories/prisma-baby-vaccine-record.repository';
import { prisma } from '../../../infrastructure/database/prisma-client';
import { redis } from '../../../infrastructure/cache/redis-client';
import { authenticate } from '../plugins/authenticate';
import { authErrorResponseSchema } from '../schemas/auth.schema';
import {
  adhocVaccineListResponseSchema,
  adhocVaccineRecordResponseSchema,
  markVaccineAppliedBodySchema,
  markVaccineAppliedParamsSchema,
  registerAdhocVaccineBodySchema,
  vaccineScheduleItemSchema,
  vaccineScheduleParamsSchema,
  vaccineScheduleResponseSchema,
} from '../schemas/vaccine.schema';

function toDateOnly(date: Date | null): string | null {
  return date ? date.toISOString().slice(0, 10) : null;
}

function toAdhocResponse(record: BabyVaccineRecord) {
  return {
    id: record.id,
    babyId: record.babyId,
    source: record.source as 'CAMPAIGN' | 'CUSTOM',
    customName: record.customName ?? '',
    customDose: record.customDose,
    status: 'APPLIED' as const,
    applicationDate: toDateOnly(record.applicationDate),
    notes: record.notes,
    batchNumber: record.batchNumber,
    location: record.location,
    professional: record.professional,
    photoUrl: record.photoUrl,
  };
}

function toScheduleResponse(schedule: AgeGroupSchedule[]) {
  return schedule.map((group) => ({
    ageInMonths: group.ageInMonths,
    items: group.items.map((item) => ({
      vaccineId: item.vaccineId,
      name: item.name,
      description: item.description,
      doseNumber: item.doseNumber,
      recommendedAgeInMonths: item.recommendedAgeInMonths,
      status: item.status,
      applicationDate: toDateOnly(item.applicationDate),
      notes: item.notes,
      batchNumber: item.batchNumber,
      location: item.location,
      professional: item.professional,
      photoUrl: item.photoUrl,
    })),
  }));
}

export async function vaccineRoutes(app: App) {
  const babyRepository = new PrismaBabyRepository(prisma);
  const vaccineRepository = new CachedVaccineRepository(new PrismaVaccineRepository(prisma), redis);
  const babyVaccineRecordRepository = new PrismaBabyVaccineRecordRepository(prisma);
  const getBabyVaccineScheduleUseCase = new GetBabyVaccineScheduleUseCase(
    babyRepository,
    vaccineRepository,
    babyVaccineRecordRepository,
  );
  const markVaccineAsAppliedUseCase = new MarkVaccineAsAppliedUseCase(
    babyRepository,
    vaccineRepository,
    babyVaccineRecordRepository,
  );
  const registerAdhocVaccineUseCase = new RegisterAdhocVaccineUseCase(babyRepository, babyVaccineRecordRepository);
  const listAdhocVaccineRecordsUseCase = new ListAdhocVaccineRecordsUseCase(babyRepository, babyVaccineRecordRepository);

  app.route({
    method: 'GET',
    url: '/babies/:babyId/vaccines',
    preHandler: authenticate,
    schema: {
      tags: ['Vaccines'],
      summary: "Get a baby's vaccination schedule",
      description:
        'Returns the full vaccination calendar for the baby, grouped by recommended age in months, with each ' +
        'vaccine marked as PENDING, DELAYED (past its due date) or APPLIED.',
      params: vaccineScheduleParamsSchema,
      response: {
        200: vaccineScheduleResponseSchema,
        401: authErrorResponseSchema,
        404: authErrorResponseSchema,
        500: authErrorResponseSchema,
      },
    },
    handler: async (request, reply) => {
      try {
        const schedule = await getBabyVaccineScheduleUseCase.execute({
          babyId: request.params.babyId,
          requestingUserId: request.userId,
        });

        return reply.status(200).send(toScheduleResponse(schedule));
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
    url: '/babies/:babyId/vaccines/:vaccineId/apply',
    preHandler: authenticate,
    schema: {
      tags: ['Vaccines'],
      summary: 'Mark a vaccine dose as applied',
      description: "Records that a vaccine dose was applied, updating the baby's vaccination checklist.",
      params: markVaccineAppliedParamsSchema,
      body: markVaccineAppliedBodySchema,
      response: {
        200: vaccineScheduleItemSchema,
        401: authErrorResponseSchema,
        404: authErrorResponseSchema,
        500: authErrorResponseSchema,
      },
    },
    handler: async (request, reply) => {
      try {
        const record = await markVaccineAsAppliedUseCase.execute({
          babyId: request.params.babyId,
          vaccineId: request.params.vaccineId,
          requestingUserId: request.userId,
          applicationDate: request.body.applicationDate
            ? new Date(`${request.body.applicationDate}T00:00:00.000Z`)
            : undefined,
          notes: request.body.notes,
          batchNumber: request.body.batchNumber,
          location: request.body.location,
          professional: request.body.professional,
          photoUrl: request.body.photoUrl,
        });

        const vaccine = await vaccineRepository.findById(request.params.vaccineId);

        return reply.status(200).send({
          vaccineId: request.params.vaccineId,
          name: vaccine?.name ?? '',
          description: vaccine?.description ?? '',
          doseNumber: vaccine?.doseNumber ?? 0,
          recommendedAgeInMonths: vaccine?.recommendedAgeInMonths ?? 0,
          status: record.status,
          applicationDate: toDateOnly(record.applicationDate),
          notes: record.notes,
          batchNumber: record.batchNumber,
          location: record.location,
          professional: record.professional,
          photoUrl: record.photoUrl,
        });
      } catch (error) {
        if (error instanceof BabyNotFoundError || error instanceof VaccineNotFoundError) {
          return reply.status(404).send({ status: 'error', message: error.message });
        }

        throw error;
      }
    },
  });

  app.route({
    method: 'GET',
    url: '/babies/:babyId/vaccines/adhoc',
    preHandler: authenticate,
    schema: {
      tags: ['Vaccines'],
      summary: "List a baby's campaign/custom vaccine records",
      description:
        'Returns vaccines logged by hand (a vaccination campaign or a fully custom entry) rather than applied ' +
        'from the catalog schedule, newest application first.',
      params: vaccineScheduleParamsSchema,
      response: {
        200: adhocVaccineListResponseSchema,
        401: authErrorResponseSchema,
        404: authErrorResponseSchema,
        500: authErrorResponseSchema,
      },
    },
    handler: async (request, reply) => {
      try {
        const records = await listAdhocVaccineRecordsUseCase.execute({
          babyId: request.params.babyId,
          requestingUserId: request.userId,
        });

        return reply.status(200).send(records.map(toAdhocResponse));
      } catch (error) {
        if (error instanceof BabyNotFoundError) {
          return reply.status(404).send({ status: 'error', message: error.message });
        }

        throw error;
      }
    },
  });

  app.route({
    method: 'POST',
    url: '/babies/:babyId/vaccines/adhoc',
    preHandler: authenticate,
    schema: {
      tags: ['Vaccines'],
      summary: 'Register a campaign or custom vaccine',
      description:
        'Logs a vaccine that was not applied from the catalog schedule — a vaccination campaign (e.g. a ' +
        'seasonal flu drive) or a fully custom entry. Always recorded as already applied.',
      params: vaccineScheduleParamsSchema,
      body: registerAdhocVaccineBodySchema,
      response: {
        201: adhocVaccineRecordResponseSchema,
        400: authErrorResponseSchema,
        401: authErrorResponseSchema,
        404: authErrorResponseSchema,
        500: authErrorResponseSchema,
      },
    },
    handler: async (request, reply) => {
      try {
        const record = await registerAdhocVaccineUseCase.execute({
          babyId: request.params.babyId,
          requestingUserId: request.userId,
          source: request.body.source,
          customName: request.body.customName,
          customDose: request.body.customDose,
          applicationDate: new Date(`${request.body.applicationDate}T00:00:00.000Z`),
          notes: request.body.notes,
          batchNumber: request.body.batchNumber,
          location: request.body.location,
          professional: request.body.professional,
          photoUrl: request.body.photoUrl,
        });

        return reply.status(201).send(toAdhocResponse(record));
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
}
