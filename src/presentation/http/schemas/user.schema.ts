import { z } from 'zod';

export const updateProfileBodySchema = z
  .object({
    name: z.string().min(1).describe("The parent or caregiver's full name").optional(),
    email: z.string().email().describe('New email address. Requires currentPassword').optional(),
    password: z
      .string()
      .min(8)
      .describe('New plain-text password, at least 8 characters. Requires currentPassword')
      .optional(),
    currentPassword: z.string().min(1).describe('Required whenever email or password change').optional(),
  })
  .superRefine((body, ctx) => {
    if (Object.keys(body).length === 0) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'At least one field must be provided' });
      return;
    }

    const changesSensitiveField = body.email !== undefined || body.password !== undefined;

    if (changesSensitiveField && !body.currentPassword) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'currentPassword is required to change email or password',
        path: ['currentPassword'],
      });
    }
  });

export const deleteAccountBodySchema = z.object({
  currentPassword: z.string().min(1).describe("The user's current password, required to confirm account deletion"),
});

export type UpdateProfileBody = z.infer<typeof updateProfileBodySchema>;
export type DeleteAccountBody = z.infer<typeof deleteAccountBodySchema>;
