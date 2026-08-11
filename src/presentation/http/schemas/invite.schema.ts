import { z } from 'zod';

export const inviteBabyParamsSchema = z.object({
  babyId: z.string().uuid(),
});

export const inviteCodeParamsSchema = z.object({
  code: z.string().min(1),
});

export const guardianParamsSchema = z.object({
  babyId: z.string().uuid(),
  userId: z.string().uuid(),
});

export const createInviteBodySchema = z.object({
  inviteeEmail: z
    .string()
    .email()
    .optional()
    .describe('If provided, an invite email is sent to this address (best-effort — failure does not block the request)'),
});

export const createInviteResponseSchema = z
  .object({
    code: z.string(),
    expiresAt: z.string().datetime(),
  })
  .describe('A shareable invite code that grants guardian access to the baby once redeemed');

export const invitePreviewResponseSchema = z
  .object({
    babyName: z.string(),
    babyAvatarUrl: z.string().nullable(),
    expired: z.boolean(),
    alreadyUsed: z.boolean(),
  })
  .describe(
    'Preview of an invite for display before redeeming it. Always 200, even when expired/used, so the ' +
      'frontend can render a clear message instead of a generic error.',
  );

export const redeemInviteResponseSchema = z
  .object({
    babyId: z.string().uuid(),
    babyName: z.string(),
  })
  .describe('The baby the authenticated user just gained guardian access to');

export const guardianRoleSchema = z.enum(['OWNER', 'GUARDIAN']);

export const guardianListItemSchema = z.object({
  userId: z.string().uuid(),
  name: z.string(),
  email: z.string().email(),
  role: guardianRoleSchema,
  joinedAt: z.string().datetime(),
});

export const guardianListResponseSchema = z.array(guardianListItemSchema);

export type CreateInviteBody = z.infer<typeof createInviteBodySchema>;
export type InviteBabyParams = z.infer<typeof inviteBabyParamsSchema>;
export type InviteCodeParams = z.infer<typeof inviteCodeParamsSchema>;
export type GuardianParams = z.infer<typeof guardianParamsSchema>;
