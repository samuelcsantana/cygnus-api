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

export type RegisterBody = z.infer<typeof registerBodySchema>;
export type LoginBody = z.infer<typeof loginBodySchema>;
