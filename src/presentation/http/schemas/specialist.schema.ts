import { z } from 'zod';

export const specialistParamsSchema = z.object({
  babyId: z.string().uuid(),
});

export const specialistIdParamsSchema = z.object({
  babyId: z.string().uuid(),
  specialistId: z.string().uuid(),
});

// Free text, and no format check on the phone: a number can be a landline, a mobile, a clinic
// switchboard with an extension, or one written with the country code — and this is the field
// somebody reaches for at 3am. Refusing a real number to enforce a shape would be the one failure
// it cannot afford.
export const createSpecialistBodySchema = z.object({
  name: z.string().min(1).describe('The professional as the family refers to them, e.g. Dra. Fernanda Lima'),
  specialty: z.string().optional().describe('What they do, e.g. Pediatria. Free text, see GET /specialties'),
  phone: z.string().optional().describe('How to reach them. Stored as typed'),
});

export const updateSpecialistBodySchema = z
  .object({
    name: z.string().min(1).optional(),
    specialty: z.string().nullable().optional(),
    phone: z.string().nullable().optional(),
  })
  .refine((body) => Object.keys(body).length > 0, { message: 'At least one field must be provided' });

export const specialistResponseSchema = z
  .object({
    id: z.string().uuid(),
    babyId: z.string().uuid(),
    name: z.string(),
    specialty: z.string().nullable(),
    phone: z.string().nullable(),
    createdAt: z.string().datetime(),
  })
  .describe('A professional who looks after this baby');

export const specialistListResponseSchema = z.array(specialistResponseSchema);

export type CreateSpecialistBody = z.infer<typeof createSpecialistBodySchema>;
export type UpdateSpecialistBody = z.infer<typeof updateSpecialistBodySchema>;
