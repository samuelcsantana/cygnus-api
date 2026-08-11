import { z } from 'zod';

const categorySchema = z.enum(['MOTOR', 'LANGUAGE', 'SOCIAL', 'COGNITIVE', 'OTHER']);
const dateOnlySchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Date must be in YYYY-MM-DD format');

export const milestoneParamsSchema = z.object({
  babyId: z.string().uuid(),
});

export const milestoneListQuerystringSchema = z.object({
  search: z.string().trim().min(1).optional().describe('Case-insensitive filter matching title or description'),
});

export const milestoneIdParamsSchema = z.object({
  babyId: z.string().uuid(),
  milestoneId: z.string().uuid(),
});

export const createMilestoneBodySchema = z.object({
  title: z.string().min(1).describe("e.g. 'Primeiro sorriso', 'Primeiros passos'"),
  description: z.string().optional(),
  achievedAt: dateOnlySchema.describe("Cannot be in the future or before the baby's birth date"),
  category: categorySchema,
  photoUrl: z.string().url().optional(),
});

export const updateMilestoneBodySchema = z
  .object({
    title: z.string().min(1).optional(),
    description: z.string().nullable().optional(),
    achievedAt: dateOnlySchema.optional(),
    category: categorySchema.optional(),
    photoUrl: z.string().url().nullable().optional(),
  })
  .refine((body) => Object.keys(body).length > 0, { message: 'At least one field must be provided' });

export const milestoneResponseSchema = z
  .object({
    id: z.string().uuid(),
    babyId: z.string().uuid(),
    title: z.string(),
    description: z.string().nullable(),
    achievedAt: dateOnlySchema,
    category: categorySchema,
    photoUrl: z.string().nullable(),
    createdAt: z.string().datetime(),
  })
  .describe('A developmental milestone recorded for a baby');

export const milestoneListResponseSchema = z.array(milestoneResponseSchema);

export type CreateMilestoneBody = z.infer<typeof createMilestoneBodySchema>;
export type UpdateMilestoneBody = z.infer<typeof updateMilestoneBodySchema>;
