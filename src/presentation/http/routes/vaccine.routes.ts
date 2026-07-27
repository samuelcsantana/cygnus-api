import type { App } from '../../../infrastructure/http/build-app';
import { AgeGroupSchedule } from '../../../application/vaccine/get-baby-vaccine-schedule.use-case';
import { GetBabyVaccineScheduleUseCase } from '../../../application/vaccine/get-baby-vaccine-schedule.use-case';
import { MarkVaccineAsAppliedUseCase } from '../../../application/vaccine/mark-vaccine-as-applied.use-case';
import { BabyNotFoundError } from '../../../application/baby/errors/baby-not-found.error';
import { VaccineNotFoundError } from '../../../application/vaccine/errors/vaccine-not-found.error';
import { PrismaBabyRepository } from '../../../infrastructure/database/repositories/prisma-baby.repository';
import { PrismaVaccineRepository } from '../../../infrastructure/database/repositories/prisma-vaccine.repository';
import { PrismaBabyVaccineRecordRepository } from '../../../infrastructure/database/repositories/prisma-baby-vaccine-record.repository';
import { prisma } from '../../../infrastructure/database/prisma-client';
import { authenticate } from '../plugins/authenticate';
import { authErrorResponseSchema } from '../schemas/auth.schema';
import {
  markVaccineAppliedBodySchema,
  markVaccineAppliedParamsSchema,
  vaccineScheduleItemSchema,
  vaccineScheduleParamsSchema,
  vaccineScheduleResponseSchema,
} from '../schemas/vaccine.schema';

function toDateOnly(date: Date | null): string | null {
  return date ? date.toISOString().slice(0, 10) : null;
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
    })),
  }));
}

export async function vaccineRoutes(app: App) {
  const babyRepository = new PrismaBabyRepository(prisma);
  const vaccineRepository = new PrismaVaccineRepository(prisma);
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
        });

        const vaccine = await vaccineRepository.findById(record.vaccineId);

        return reply.status(200).send({
          vaccineId: record.vaccineId,
          name: vaccine?.name ?? '',
          description: vaccine?.description ?? '',
          doseNumber: vaccine?.doseNumber ?? 0,
          recommendedAgeInMonths: vaccine?.recommendedAgeInMonths ?? 0,
          status: record.status,
          applicationDate: toDateOnly(record.applicationDate),
          notes: record.notes,
        });
      } catch (error) {
        if (error instanceof BabyNotFoundError || error instanceof VaccineNotFoundError) {
          return reply.status(404).send({ status: 'error', message: error.message });
        }

        throw error;
      }
    },
  });
}
