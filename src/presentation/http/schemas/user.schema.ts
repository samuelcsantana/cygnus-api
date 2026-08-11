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

export const deleteAccountBodySchema = z.object({
  currentPassword: z.string().min(1).describe("The user's current password, required to confirm account deletion"),
});

export type UpdateProfileBody = z.infer<typeof updateProfileBodySchema>;
export type DeleteAccountBody = z.infer<typeof deleteAccountBodySchema>;
