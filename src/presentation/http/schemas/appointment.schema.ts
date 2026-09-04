import { z } from 'zod';

const statusSchema = z.enum(['SCHEDULED', 'COMPLETED', 'CANCELLED']);

// Whole units of gram and millimetre, the resolution a scale and a stadiometer actually read, and
// the units are in the field names so nothing downstream has to guess. The bounds only reject what
// no child can be — a mistyped extra digit — and stay wide on purpose: a growth record that
// refuses a real measurement is worse than one that stores an odd-looking value.
const weightGramsSchema = z
  .number()
  .int()
  .min(100)
  .max(150000)
  .describe('Weight at the visit, in grams (100 g to 150 kg)');
const heightMillimetersSchema = z
  .number()
  .int()
  .min(100)
  .max(2500)
  .describe('Height at the visit, in millimetres (10 cm to 250 cm)');

export const appointmentParamsSchema = z.object({
  babyId: z.string().uuid(),
});

export const appointmentListQuerystringSchema = z.object({
  search: z
    .string()
    .trim()
    .min(1)
    .optional()
    .describe('Case-insensitive filter matching doctorName, specialty, location or reason'),
});

export const appointmentIdParamsSchema = z.object({
  babyId: z.string().uuid(),
  appointmentId: z.string().uuid(),
});

export const createAppointmentBodySchema = z.object({
  scheduledAt: z.string().datetime().describe('ISO-8601 date and time of the appointment. Must be in the future unless status is COMPLETED'),
  doctorName: z.string().min(1),
  specialty: z.string().optional().describe('Medical specialty of the professional, e.g. Pediatria'),
  location: z.string().optional(),
  reason: z.string().optional().describe('Reason for the visit, e.g. routine check-up'),
  weightGrams: weightGramsSchema.optional(),
  heightMillimeters: heightMillimetersSchema.optional(),
  specialistId: z
    .string()
    .uuid()
    .optional()
    .describe('Links this visit to a saved specialist. `doctorName` is still required and stays as typed'),
  status: z
    .enum(['SCHEDULED', 'COMPLETED'])
    .optional()
    .describe(
      'SCHEDULED (default) books an upcoming appointment and rejects a past date. COMPLETED records ' +
        'a consultation that already happened and rejects a future one.',
    ),
});

export const updateAppointmentBodySchema = z
  .object({
    scheduledAt: z.string().datetime().optional(),
    doctorName: z.string().min(1).optional(),
    specialty: z.string().nullable().optional(),
    location: z.string().nullable().optional(),
    reason: z.string().nullable().optional(),
    notes: z.string().nullable().optional().describe('Notes added after the visit, e.g. reactions, recommendations'),
    weightGrams: weightGramsSchema.nullable().optional(),
    heightMillimeters: heightMillimetersSchema.nullable().optional(),
    specialistId: z.string().uuid().nullable().optional(),
    status: z.enum(['COMPLETED', 'CANCELLED']).optional(),
  })
  .refine((body) => Object.keys(body).length > 0, { message: 'At least one field must be provided' });

export const appointmentResponseSchema = z
  .object({
    id: z.string().uuid(),
    babyId: z.string().uuid(),
    scheduledAt: z.string().datetime(),
    doctorName: z.string(),
    specialty: z.string().nullable(),
    location: z.string().nullable(),
    reason: z.string().nullable(),
    notes: z.string().nullable(),
    status: statusSchema,
    specialistId: z.string().uuid().nullable(),
    weightGrams: z.number().int().nullable(),
    heightMillimeters: z.number().int().nullable(),
    createdAt: z.string().datetime(),
  })
  .describe('A pediatric appointment for a baby');

export const appointmentListResponseSchema = z.array(appointmentResponseSchema);

export type CreateAppointmentBody = z.infer<typeof createAppointmentBodySchema>;
export type UpdateAppointmentBody = z.infer<typeof updateAppointmentBodySchema>;
