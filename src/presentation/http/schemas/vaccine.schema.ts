import { z } from 'zod';

const dateOnlySchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Date must be in YYYY-MM-DD format');
const statusSchema = z.enum(['PENDING', 'APPLIED', 'DELAYED']);

export const vaccineScheduleParamsSchema = z.object({
  babyId: z.string().uuid(),
});

export const markVaccineAppliedParamsSchema = z.object({
  babyId: z.string().uuid(),
  vaccineId: z.string().uuid(),
});

export const markVaccineAppliedBodySchema = z.object({
  applicationDate: dateOnlySchema.optional().describe('Defaults to today when omitted'),
  notes: z.string().optional(),
});

export const vaccineScheduleItemSchema = z.object({
  vaccineId: z.string().uuid(),
  name: z.string(),
  description: z.string(),
  doseNumber: z.number().int(),
  recommendedAgeInMonths: z.number().int(),
  status: statusSchema,
  applicationDate: dateOnlySchema.nullable(),
  notes: z.string().nullable(),
});

export const ageGroupScheduleSchema = z.object({
  ageInMonths: z.number().int(),
  items: z.array(vaccineScheduleItemSchema),
});

export const vaccineScheduleResponseSchema = z
  .array(ageGroupScheduleSchema)
  .describe('The full vaccination calendar for the baby, grouped by recommended age in months');

export type MarkVaccineAppliedBody = z.infer<typeof markVaccineAppliedBodySchema>;
