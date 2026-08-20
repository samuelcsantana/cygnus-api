import { z } from 'zod';

export const publicVaccineScheduleItemSchema = z.object({
  id: z.string().uuid(),
  name: z.string().describe('Vaccine name as published by the Brazilian PNI'),
  description: z.string(),
  recommendedAgeInMonths: z.number().int().describe('Age at which this dose is recommended, in months. 0 means at birth'),
  doseNumber: z.number().int().describe('Which dose of this vaccine this row represents'),
});

export const publicVaccineScheduleResponseSchema = z
  .object({
    schedule: z.array(publicVaccineScheduleItemSchema),
  })
  .describe('The public PNI immunization schedule. Reference data — identical for every visitor, tied to no account');
