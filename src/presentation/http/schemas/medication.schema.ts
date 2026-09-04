import { z } from 'zod';

const dateOnlySchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Date must be in YYYY-MM-DD format');

export const medicationParamsSchema = z.object({
  babyId: z.string().uuid(),
});

export const medicationIdParamsSchema = z.object({
  babyId: z.string().uuid(),
  medicationId: z.string().uuid(),
});

// Dose and frequency are free text, and deliberately so: the units are not enumerable in any
// useful way — drops, ml, mg, half a tablet, "every 8 hours", "when the fever comes back". A field
// that refuses what the prescription actually says is worse than one that stores it verbatim.
export const createMedicationBodySchema = z.object({
  name: z.string().min(1).describe('What was prescribed, e.g. Vitamina D'),
  startedOn: dateOnlySchema.describe('First day of the course, formatted as YYYY-MM-DD'),
  dosage: z.string().optional().describe('As written on the prescription, e.g. "5 gotas"'),
  frequency: z.string().optional().describe('As written on the prescription, e.g. "1x ao dia"'),
  reason: z.string().optional().describe('Why it was prescribed, e.g. suplementação'),
  prescriberName: z.string().optional().describe('Who prescribed it, as the family refers to them'),
  endedOn: dateOnlySchema.optional().describe('Last day of the course. Absent means no recorded end'),
  notes: z.string().optional(),
});

export const updateMedicationBodySchema = z
  .object({
    name: z.string().min(1).optional(),
    startedOn: dateOnlySchema.optional(),
    dosage: z.string().nullable().optional(),
    frequency: z.string().nullable().optional(),
    reason: z.string().nullable().optional(),
    prescriberName: z.string().nullable().optional(),
    // The most common edit this route will ever get: ending a course. `null` reopens it, absent
    // leaves it as it was.
    endedOn: dateOnlySchema.nullable().optional(),
    notes: z.string().nullable().optional(),
  })
  .refine((body) => Object.keys(body).length > 0, { message: 'At least one field must be provided' });

export const medicationResponseSchema = z
  .object({
    id: z.string().uuid(),
    babyId: z.string().uuid(),
    name: z.string(),
    dosage: z.string().nullable(),
    frequency: z.string().nullable(),
    reason: z.string().nullable(),
    prescriberName: z.string().nullable(),
    startedOn: dateOnlySchema,
    endedOn: dateOnlySchema.nullable(),
    notes: z.string().nullable(),
    createdAt: z.string().datetime(),
  })
  .describe('A medication this baby was prescribed. A record of what was prescribed, not advice');

export const medicationListResponseSchema = z.array(medicationResponseSchema);

export type CreateMedicationBody = z.infer<typeof createMedicationBodySchema>;
export type UpdateMedicationBody = z.infer<typeof updateMedicationBodySchema>;
