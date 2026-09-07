import { z } from 'zod';
import { babyResponseSchema } from './baby.schema';
import { appointmentListResponseSchema } from './appointment.schema';
import { milestoneListResponseSchema } from './milestone.schema';

const dateOnlySchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Date must be in YYYY-MM-DD format');

const exportedVaccineRecordSchema = z.object({
  id: z.string().uuid(),
  vaccineId: z.string().uuid().nullable(),
  source: z.enum(['CATALOG', 'CAMPAIGN', 'CUSTOM']),
  customName: z.string().nullable(),
  customDose: z.string().nullable(),
  status: z.literal('APPLIED'),
  applicationDate: dateOnlySchema.nullable(),
  notes: z.string().nullable(),
  batchNumber: z.string().nullable(),
  location: z.string().nullable(),
  professional: z.string().nullable(),
  photoUrl: z.string().nullable(),
});

export const exportUserDataResponseSchema = z
  .object({
    user: z.object({
      id: z.string().uuid(),
      email: z.string().email(),
      name: z.string(),
      emailNotificationsEnabled: z.boolean(),
      createdAt: z.string().datetime(),
    }),
    babies: z.array(
      z.object({
        profile: babyResponseSchema,
        vaccineRecords: z.array(exportedVaccineRecordSchema),
        appointments: appointmentListResponseSchema,
        milestones: milestoneListResponseSchema,
      }),
    ),
  })
  .describe("The authenticated user's full data set (LGPD data portability export)");

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
    emailNotificationsEnabled: z
      .boolean()
      .describe('Whether the user wants to receive reminder emails (vaccines, appointments)')
      .optional(),
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

/**
 * One proof of intent, and exactly one.
 *
 * `code` exists because an account created by passwordless sign-in has no usable password — its
 * hash is random bytes — so the password path locks it out of its own deletion for good. Requiring
 * both would be theatre: whoever holds the mailbox can already take the account over by signing in
 * without a password.
 *
 * Refused when neither is given (an empty body must not delete anything) and when both are, which
 * is a caller that has not decided what it is proving.
 */
export const deleteAccountBodySchema = z
  .object({
    currentPassword: z
      .string()
      .min(1)
      .optional()
      .describe("The user's current password, one of the two ways to confirm account deletion"),
    code: z
      .string()
      .regex(/^\d{6}$/)
      .optional()
      .describe('A 6-digit code mailed by POST /users/me/deletion-code, the other way to confirm'),
  })
  .refine((body) => (body.currentPassword === undefined) !== (body.code === undefined), {
    message: 'Provide either currentPassword or code',
  });

export type UpdateProfileBody = z.infer<typeof updateProfileBodySchema>;
export type DeleteAccountBody = z.infer<typeof deleteAccountBodySchema>;
