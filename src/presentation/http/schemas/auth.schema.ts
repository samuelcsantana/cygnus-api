import { z } from 'zod';

export const registerBodySchema = z.object({
  email: z.string().email().describe("The parent or caregiver's email address"),
  password: z.string().min(8).describe('Plain-text password, at least 8 characters long'),
  name: z.string().min(1).describe("The parent or caregiver's full name"),
});

export const registerResponseSchema = z
  .object({
    id: z.string().uuid(),
    email: z.string().email(),
    name: z.string(),
    emailNotificationsEnabled: z.boolean(),
    createdAt: z.string().datetime(),
  })
  .describe('The newly created user account');

export const loginBodySchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

export const currentUserResponseSchema = z
  .object({
    id: z.string().uuid(),
    email: z.string().email(),
    name: z.string(),
    emailNotificationsEnabled: z
      .boolean()
      .describe('Whether the user wants to receive reminder emails (vaccines, appointments)'),
    createdAt: z.string().datetime(),
  })
  .describe('The authenticated user account');

export const authSuccessResponseSchema = z
  .object({
    status: z.literal('ok'),
    message: z.string(),
  })
  .describe('Access and refresh tokens are set as HTTP-only cookies');

export const authErrorResponseSchema = z
  .object({
    status: z.literal('error'),
    message: z.string(),
  })
  .describe('The request could not be completed');

export const assistedRequestBodySchema = z.object({
  email: z.string().email().describe('The address to mail a 6-digit code to'),
});

/**
 * Deliberately NOT `.regex(/^\d{6}$/)`, even though the code always is six digits.
 *
 * A schema violation is answered with 400 by the global error handler, and the frontend reads only
 * 401/410 as "wrong or expired code" — so validating the shape here would turn a mistyped code into
 * the generic "something went wrong" message instead of the one that tells the user to check the
 * digits. A wrong shape simply fails to match the stored hash and comes back 401 like any other
 * wrong code. The bound is there so a caller cannot make us hash a megabyte.
 */
const verificationCodeField = z.string().min(1).max(64).describe('The 6-digit code from the e-mail');

export const passwordlessVerifyBodySchema = z.object({
  email: z.string().email(),
  code: verificationCodeField,
});

export const passwordResetVerifyBodySchema = z.object({
  email: z.string().email(),
  code: verificationCodeField,
  password: z.string().min(8).describe('The new password, at least 8 characters long'),
});

export type RegisterBody = z.infer<typeof registerBodySchema>;
export type LoginBody = z.infer<typeof loginBodySchema>;
