import { z } from 'zod';

const statusSchema = z.enum(['SCHEDULED', 'COMPLETED', 'CANCELLED']);

export const appointmentParamsSchema = z.object({
  babyId: z.string().uuid(),
});

export const appointmentIdParamsSchema = z.object({
  babyId: z.string().uuid(),
  appointmentId: z.string().uuid(),
});

export const createAppointmentBodySchema = z.object({
  scheduledAt: z.string().datetime().describe('ISO-8601 date and time of the appointment. Cannot be in the past'),
  doctorName: z.string().min(1),
  location: z.string().optional(),
  reason: z.string().optional().describe('Reason for the visit, e.g. routine check-up'),
});

export const updateAppointmentBodySchema = z
  .object({
    scheduledAt: z.string().datetime().optional(),
    doctorName: z.string().min(1).optional(),
    location: z.string().nullable().optional(),
    reason: z.string().nullable().optional(),
    notes: z.string().nullable().optional().describe('Notes added after the visit, e.g. reactions, recommendations'),
    status: z.enum(['COMPLETED', 'CANCELLED']).optional(),
  })
  .refine((body) => Object.keys(body).length > 0, { message: 'At least one field must be provided' });

export const appointmentResponseSchema = z
  .object({
    id: z.string().uuid(),
    babyId: z.string().uuid(),
    scheduledAt: z.string().datetime(),
    doctorName: z.string(),
    location: z.string().nullable(),
    reason: z.string().nullable(),
    notes: z.string().nullable(),
    status: statusSchema,
    createdAt: z.string().datetime(),
  })
  .describe('A pediatric appointment for a baby');

export const appointmentListResponseSchema = z.array(appointmentResponseSchema);

export type CreateAppointmentBody = z.infer<typeof createAppointmentBodySchema>;
export type UpdateAppointmentBody = z.infer<typeof updateAppointmentBodySchema>;
