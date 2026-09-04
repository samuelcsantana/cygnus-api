import { z } from 'zod';

import type { App } from '../../../infrastructure/http/build-app';
import { Appointment } from '../../../domain/appointment/appointment';
import { CreateAppointmentUseCase } from '../../../application/appointment/create-appointment.use-case';
import { ListBabyAppointmentsUseCase } from '../../../application/appointment/list-baby-appointments.use-case';
import { GetAppointmentByIdUseCase } from '../../../application/appointment/get-appointment-by-id.use-case';
import { UpdateAppointmentUseCase } from '../../../application/appointment/update-appointment.use-case';
import { DeleteAppointmentUseCase } from '../../../application/appointment/delete-appointment.use-case';
import { AppointmentNotFoundError } from '../../../application/appointment/errors/appointment-not-found.error';
import { BabyNotFoundError } from '../../../application/baby/errors/baby-not-found.error';
import { DomainError } from '../../../shared/errors/domain-error';
import { PrismaBabyRepository } from '../../../infrastructure/database/repositories/prisma-baby.repository';
import { PrismaBabyGuardianRepository } from '../../../infrastructure/database/repositories/prisma-baby-guardian.repository';
import { PrismaAppointmentRepository } from '../../../infrastructure/database/repositories/prisma-appointment.repository';
import { prisma } from '../../../infrastructure/database/prisma-client';
import { auditLogger } from '../../../infrastructure/audit/audit-logger.instance';
import { authenticate } from '../plugins/authenticate';
import { authErrorResponseSchema } from '../schemas/auth.schema';
import {
  appointmentIdParamsSchema,
  appointmentListQuerystringSchema,
  appointmentListResponseSchema,
  appointmentParamsSchema,
  appointmentResponseSchema,
  createAppointmentBodySchema,
  updateAppointmentBodySchema,
} from '../schemas/appointment.schema';

function toResponse(appointment: Appointment) {
  return {
    id: appointment.id,
    babyId: appointment.babyId,
    scheduledAt: appointment.scheduledAt.toISOString(),
    doctorName: appointment.doctorName,
    specialty: appointment.specialty,
    location: appointment.location,
    reason: appointment.reason,
    notes: appointment.notes,
    status: appointment.status,
    weightGrams: appointment.weightGrams,
    heightMillimeters: appointment.heightMillimeters,
    createdAt: appointment.createdAt.toISOString(),
  };
}

export async function appointmentRoutes(app: App) {
  const babyRepository = new PrismaBabyRepository(prisma);
  const babyGuardianRepository = new PrismaBabyGuardianRepository(prisma);
  const appointmentRepository = new PrismaAppointmentRepository(prisma);
  const createAppointmentUseCase = new CreateAppointmentUseCase(
    babyRepository,
    babyGuardianRepository,
    appointmentRepository,
  );
  const listBabyAppointmentsUseCase = new ListBabyAppointmentsUseCase(
    babyRepository,
    babyGuardianRepository,
    appointmentRepository,
  );
  const getAppointmentByIdUseCase = new GetAppointmentByIdUseCase(
    babyRepository,
    babyGuardianRepository,
    appointmentRepository,
  );
  const deleteAppointmentUseCase = new DeleteAppointmentUseCase(
    babyRepository,
    babyGuardianRepository,
    appointmentRepository,
  );
  const updateAppointmentUseCase = new UpdateAppointmentUseCase(
    babyRepository,
    babyGuardianRepository,
    appointmentRepository,
  );

  app.route({
    method: 'POST',
    url: '/babies/:babyId/appointments',
    preHandler: authenticate,
    schema: {
      tags: ['Appointments'],
      summary: 'Schedule a pediatric appointment',
      description: "Creates a new appointment for the baby. The scheduled date/time cannot be in the past.",
      params: appointmentParamsSchema,
      body: createAppointmentBodySchema,
      response: {
        201: appointmentResponseSchema,
        400: authErrorResponseSchema,
        401: authErrorResponseSchema,
        404: authErrorResponseSchema,
        500: authErrorResponseSchema,
      },
    },
    handler: async (request, reply) => {
      try {
        const appointment = await createAppointmentUseCase.execute({
          babyId: request.params.babyId,
          requestingUserId: request.userId,
          scheduledAt: new Date(request.body.scheduledAt),
          doctorName: request.body.doctorName,
          specialty: request.body.specialty,
          location: request.body.location,
          reason: request.body.reason,
          weightGrams: request.body.weightGrams,
          heightMillimeters: request.body.heightMillimeters,
          status: request.body.status,
        });

        auditLogger.log({
          userId: request.userId,
          action: 'appointment.create',
          resourceType: 'Appointment',
          resourceId: appointment.id,
          babyId: appointment.babyId,
        });

        return reply.status(201).send(toResponse(appointment));
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
    url: '/babies/:babyId/appointments',
    preHandler: authenticate,
    schema: {
      tags: ['Appointments'],
      summary: "List a baby's appointments",
      description:
        'Optionally filtered by `search`, matched case-insensitively against doctorName, specialty, location ' +
        'or reason.',
      params: appointmentParamsSchema,
      querystring: appointmentListQuerystringSchema,
      response: {
        200: appointmentListResponseSchema,
        401: authErrorResponseSchema,
        404: authErrorResponseSchema,
        500: authErrorResponseSchema,
      },
    },
    handler: async (request, reply) => {
      try {
        const appointments = await listBabyAppointmentsUseCase.execute({
          babyId: request.params.babyId,
          requestingUserId: request.userId,
          search: request.query.search,
        });

        return reply.status(200).send(appointments.map(toResponse));
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
    url: '/babies/:babyId/appointments/:appointmentId',
    preHandler: authenticate,
    schema: {
      tags: ['Appointments'],
      summary: 'Get an appointment by id',
      params: appointmentIdParamsSchema,
      response: {
        200: appointmentResponseSchema,
        401: authErrorResponseSchema,
        404: authErrorResponseSchema,
        500: authErrorResponseSchema,
      },
    },
    handler: async (request, reply) => {
      try {
        const appointment = await getAppointmentByIdUseCase.execute({
          babyId: request.params.babyId,
          appointmentId: request.params.appointmentId,
          requestingUserId: request.userId,
        });

        return reply.status(200).send(toResponse(appointment));
      } catch (error) {
        if (error instanceof BabyNotFoundError || error instanceof AppointmentNotFoundError) {
          return reply.status(404).send({ status: 'error', message: error.message });
        }

        throw error;
      }
    },
  });

  app.route({
    method: 'PATCH',
    url: '/babies/:babyId/appointments/:appointmentId',
    preHandler: authenticate,
    schema: {
      tags: ['Appointments'],
      summary: 'Reschedule, annotate or close an appointment',
      description:
        'Supports rescheduling (new scheduledAt, which cannot be in the past), adding notes, and marking the ' +
        'appointment as COMPLETED or CANCELLED.',
      params: appointmentIdParamsSchema,
      body: updateAppointmentBodySchema,
      response: {
        200: appointmentResponseSchema,
        400: authErrorResponseSchema,
        401: authErrorResponseSchema,
        404: authErrorResponseSchema,
        500: authErrorResponseSchema,
      },
    },
    handler: async (request, reply) => {
      try {
        const appointment = await updateAppointmentUseCase.execute({
          babyId: request.params.babyId,
          appointmentId: request.params.appointmentId,
          requestingUserId: request.userId,
          scheduledAt: request.body.scheduledAt ? new Date(request.body.scheduledAt) : undefined,
          doctorName: request.body.doctorName,
          specialty: request.body.specialty,
          location: request.body.location,
          reason: request.body.reason,
          notes: request.body.notes,
          weightGrams: request.body.weightGrams,
          heightMillimeters: request.body.heightMillimeters,
          status: request.body.status,
        });

        auditLogger.log({
          userId: request.userId,
          action: 'appointment.update',
          resourceType: 'Appointment',
          resourceId: appointment.id,
          babyId: appointment.babyId,
        });

        return reply.status(200).send(toResponse(appointment));
      } catch (error) {
        if (error instanceof BabyNotFoundError || error instanceof AppointmentNotFoundError) {
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
    url: '/babies/:babyId/appointments/:appointmentId',
    preHandler: authenticate,
    schema: {
      tags: ['Appointments'],
      summary: 'Delete an appointment',
      description:
        'Removes the appointment for good. Distinct from cancelling, which is PATCH status=CANCELLED and keeps the row because a called-off visit is part of the history. Deleting is for a record that should not exist — usually one entered by mistake. No status is exempt: a typo in a completed visit is as wrong as one in a scheduled visit.',
      params: appointmentIdParamsSchema,
      response: {
        204: z.null().describe('Appointment deleted successfully'),
        401: authErrorResponseSchema,
        404: authErrorResponseSchema,
        500: authErrorResponseSchema,
      },
    },
    handler: async (request, reply) => {
      try {
        await deleteAppointmentUseCase.execute({
          babyId: request.params.babyId,
          appointmentId: request.params.appointmentId,
          requestingUserId: request.userId,
        });

        auditLogger.log({
          userId: request.userId,
          action: 'appointment.delete',
          resourceType: 'Appointment',
          resourceId: request.params.appointmentId,
          babyId: request.params.babyId,
        });

        return reply.status(204).send(null);
      } catch (error) {
        if (error instanceof BabyNotFoundError || error instanceof AppointmentNotFoundError) {
          return reply.status(404).send({ status: 'error', message: error.message });
        }

        throw error;
      }
    },
  });
}
