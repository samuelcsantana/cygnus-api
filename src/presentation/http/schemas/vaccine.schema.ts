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
  batchNumber: z.string().optional(),
  location: z.string().optional(),
  professional: z.string().optional(),
  photoUrl: z.string().url().optional(),
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
  batchNumber: z.string().nullable(),
  location: z.string().nullable(),
  professional: z.string().nullable(),
  photoUrl: z.string().nullable(),
});

export const ageGroupScheduleSchema = z.object({
  ageInMonths: z.number().int(),
  items: z.array(vaccineScheduleItemSchema),
});

export const vaccineScheduleResponseSchema = z
  .array(ageGroupScheduleSchema)
  .describe('The full vaccination calendar for the baby, grouped by recommended age in months');

const adhocVaccineSourceSchema = z.enum(['CAMPAIGN', 'CUSTOM']);

export const registerAdhocVaccineBodySchema = z.object({
  source: adhocVaccineSourceSchema,
  customName: z.string().trim().min(1),
  customDose: z.string().trim().optional(),
  applicationDate: dateOnlySchema,
  notes: z.string().optional(),
  batchNumber: z.string().optional(),
  location: z.string().optional(),
  professional: z.string().optional(),
  photoUrl: z.string().url().optional(),
});

export const adhocVaccineRecordResponseSchema = z.object({
  id: z.string().uuid(),
  babyId: z.string().uuid(),
  source: adhocVaccineSourceSchema,
  customName: z.string(),
  customDose: z.string().nullable(),
  status: z.literal('APPLIED'),
  applicationDate: dateOnlySchema.nullable(),
  notes: z.string().nullable(),
  batchNumber: z.string().nullable(),
  location: z.string().nullable(),
  professional: z.string().nullable(),
  photoUrl: z.string().nullable(),
});

export const adhocVaccineListResponseSchema = z
  .array(adhocVaccineRecordResponseSchema)
  .describe('Campaign/custom vaccine records logged by hand, newest application first');

export type MarkVaccineAppliedBody = z.infer<typeof markVaccineAppliedBodySchema>;
export type RegisterAdhocVaccineBody = z.infer<typeof registerAdhocVaccineBodySchema>;
