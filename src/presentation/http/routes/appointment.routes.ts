import type { App } from '../../../infrastructure/http/build-app';
import { Appointment } from '../../../domain/appointment/appointment';
import { CreateAppointmentUseCase } from '../../../application/appointment/create-appointment.use-case';
import { ListBabyAppointmentsUseCase } from '../../../application/appointment/list-baby-appointments.use-case';
import { GetAppointmentByIdUseCase } from '../../../application/appointment/get-appointment-by-id.use-case';
import { UpdateAppointmentUseCase } from '../../../application/appointment/update-appointment.use-case';
import { AppointmentNotFoundError } from '../../../application/appointment/errors/appointment-not-found.error';
import { BabyNotFoundError } from '../../../application/baby/errors/baby-not-found.error';
import { DomainError } from '../../../shared/errors/domain-error';
import { PrismaBabyRepository } from '../../../infrastructure/database/repositories/prisma-baby.repository';
import { PrismaAppointmentRepository } from '../../../infrastructure/database/repositories/prisma-appointment.repository';
import { prisma } from '../../../infrastructure/database/prisma-client';
import { auditLogger } from '../../../infrastructure/audit/audit-logger.instance';
import { authenticate } from '../plugins/authenticate';
import { authErrorResponseSchema } from '../schemas/auth.schema';
import {
  appointmentIdParamsSchema,
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
    createdAt: appointment.createdAt.toISOString(),
  };
}

export async function appointmentRoutes(app: App) {
  const babyRepository = new PrismaBabyRepository(prisma);
  const appointmentRepository = new PrismaAppointmentRepository(prisma);
  const createAppointmentUseCase = new CreateAppointmentUseCase(babyRepository, appointmentRepository);
  const listBabyAppointmentsUseCase = new ListBabyAppointmentsUseCase(babyRepository, appointmentRepository);
  const getAppointmentByIdUseCase = new GetAppointmentByIdUseCase(babyRepository, appointmentRepository);
  const updateAppointmentUseCase = new UpdateAppointmentUseCase(babyRepository, appointmentRepository);

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
      params: appointmentParamsSchema,
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
}
