import { z } from 'zod';

const genderSchema = z.enum(['MALE', 'FEMALE']);
const bloodTypeSchema = z.enum(['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-']);
const dateOnlySchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Date must be in YYYY-MM-DD format');

export const babyParamsSchema = z.object({
  babyId: z.string().uuid(),
});

export const createBabyBodySchema = z.object({
  name: z.string().min(1).describe("The baby's full name"),
  birthDate: dateOnlySchema.describe('Date of birth, formatted as YYYY-MM-DD. Cannot be in the future'),
  gender: genderSchema,
  bloodType: bloodTypeSchema.optional(),
  allergies: z.array(z.string().min(1)).optional().describe('Known allergies, e.g. lactose, penicillin'),
  avatarUrl: z.string().url().optional(),
});

export const updateBabyBodySchema = z
  .object({
    name: z.string().min(1).optional(),
    birthDate: dateOnlySchema.optional(),
    gender: genderSchema.optional(),
    bloodType: bloodTypeSchema.nullable().optional(),
    allergies: z.array(z.string().min(1)).optional(),
    avatarUrl: z.string().url().nullable().optional(),
  })
  .refine((body) => Object.keys(body).length > 0, { message: 'At least one field must be provided' });

export const babyResponseSchema = z
  .object({
    id: z.string().uuid(),
    userId: z.string().uuid(),
    name: z.string(),
    birthDate: dateOnlySchema,
    gender: genderSchema,
    bloodType: z.string().nullable(),
    allergies: z.array(z.string()),
    avatarUrl: z.string().nullable(),
    createdAt: z.string().datetime(),
  })
  .describe('A baby profile owned by the authenticated user');

export const babyListResponseSchema = z.array(babyResponseSchema);

export type CreateBabyBody = z.infer<typeof createBabyBodySchema>;
export type UpdateBabyBody = z.infer<typeof updateBabyBodySchema>;
export type BabyParams = z.infer<typeof babyParamsSchema>;
