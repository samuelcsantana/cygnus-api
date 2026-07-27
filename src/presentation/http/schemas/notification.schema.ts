import { z } from 'zod';

export const notificationParamsSchema = z.object({
  notificationId: z.string().uuid(),
});

export const notificationResponseSchema = z
  .object({
    id: z.string().uuid(),
    babyId: z.string().uuid(),
    type: z.enum(['VACCINE_DELAYED', 'APPOINTMENT_UPCOMING']),
    referenceId: z.string(),
    title: z.string(),
    message: z.string(),
    readAt: z.string().datetime().nullable(),
    createdAt: z.string().datetime(),
  })
  .describe('An in-app alert generated for the authenticated user');

export const notificationListResponseSchema = z.array(notificationResponseSchema);
