import type { FastifyReply } from 'fastify';
import type { App } from '../../../infrastructure/http/build-app';
import { RegisterUserUseCase } from '../../../application/user/register-user.use-case';
import { AuthenticateUserUseCase } from '../../../application/user/authenticate-user.use-case';
import { EmailAlreadyInUseError } from '../../../application/user/errors/email-already-in-use.error';
import { InvalidCredentialsError } from '../../../application/user/errors/invalid-credentials.error';
import { DomainError } from '../../../shared/errors/domain-error';
import { PrismaUserRepository } from '../../../infrastructure/database/repositories/prisma-user.repository';
import { BcryptPasswordHasher } from '../../../infrastructure/security/bcrypt-password-hasher';
import { tokenService } from '../../../infrastructure/security/token-service.instance';
import { prisma } from '../../../infrastructure/database/prisma-client';
import { env } from '../../../shared/config/env';
import { parseDurationToSeconds } from '../../../shared/utils/parse-duration';
import {
  authErrorResponseSchema,
  authSuccessResponseSchema,
  loginBodySchema,
  registerBodySchema,
  registerResponseSchema,
} from '../schemas/auth.schema';

const ACCESS_TOKEN_COOKIE = 'access_token';
const REFRESH_TOKEN_COOKIE = 'refresh_token';

function setAuthCookies(reply: FastifyReply, accessToken: string, refreshToken: string): void {
  const cookieOptions = {
    httpOnly: true,
    secure: env.NODE_ENV === 'production',
    sameSite: 'strict' as const,
    path: '/',
  };

  reply.setCookie(ACCESS_TOKEN_COOKIE, accessToken, {
    ...cookieOptions,
    maxAge: parseDurationToSeconds(env.JWT_ACCESS_EXPIRES_IN),
  });

  reply.setCookie(REFRESH_TOKEN_COOKIE, refreshToken, {
    ...cookieOptions,
    maxAge: parseDurationToSeconds(env.JWT_REFRESH_EXPIRES_IN),
  });
}

function clearAuthCookies(reply: FastifyReply): void {
  reply.clearCookie(ACCESS_TOKEN_COOKIE, { path: '/' });
  reply.clearCookie(REFRESH_TOKEN_COOKIE, { path: '/' });
}

export async function authRoutes(app: App) {
  const userRepository = new PrismaUserRepository(prisma);
  const passwordHasher = new BcryptPasswordHasher();
  const registerUserUseCase = new RegisterUserUseCase(userRepository, passwordHasher);
  const authenticateUserUseCase = new AuthenticateUserUseCase(userRepository, passwordHasher, tokenService);

  app.route({
    method: 'POST',
    url: '/auth/register',
    schema: {
      tags: ['Auth'],
      summary: 'Register a new user account',
      description: 'Creates a new parent/caregiver account. Does not authenticate the user automatically.',
      body: registerBodySchema,
      response: {
        201: registerResponseSchema,
        400: authErrorResponseSchema,
        409: authErrorResponseSchema,
        500: authErrorResponseSchema,
      },
    },
    handler: async (request, reply) => {
      try {
        const user = await registerUserUseCase.execute(request.body);

        request.log.info({ userId: user.id }, 'auth.register_succeeded');

        return reply.status(201).send({
          id: user.id,
          email: user.email,
          name: user.name,
          createdAt: user.createdAt.toISOString(),
        });
      } catch (error) {
        if (error instanceof EmailAlreadyInUseError) {
          return reply.status(409).send({ status: 'error', message: error.message });
        }

        if (error instanceof DomainError) {
          return reply.status(400).send({ status: 'error', message: error.message });
        }

        throw error;
      }
    },
  });

  app.route({
    method: 'POST',
    url: '/auth/login',
    schema: {
      tags: ['Auth'],
      summary: 'Authenticate a user',
      description:
        'Validates credentials and sets access and refresh tokens as HTTP-only, Secure, SameSite=Strict cookies. Tokens are never returned in the JSON body.',
      body: loginBodySchema,
      response: {
        200: authSuccessResponseSchema,
        400: authErrorResponseSchema,
        401: authErrorResponseSchema,
        500: authErrorResponseSchema,
      },
    },
    handler: async (request, reply) => {
      try {
        const { accessToken, refreshToken } = await authenticateUserUseCase.execute(request.body);

        setAuthCookies(reply, accessToken, refreshToken);

        request.log.info('auth.login_succeeded');

        return reply.status(200).send({ status: 'ok', message: 'Authenticated successfully' });
      } catch (error) {
        if (error instanceof InvalidCredentialsError) {
          return reply.status(401).send({ status: 'error', message: error.message });
        }

        throw error;
      }
    },
  });

  app.route({
    method: 'POST',
    url: '/auth/logout',
    schema: {
      tags: ['Auth'],
      summary: 'Log out the current user',
      description: 'Clears the access and refresh token cookies.',
      response: {
        200: authSuccessResponseSchema,
        500: authErrorResponseSchema,
      },
    },
    handler: async (request, reply) => {
      clearAuthCookies(reply);

      request.log.info('auth.logout_succeeded');

      return reply.status(200).send({ status: 'ok', message: 'Logged out successfully' });
    },
  });
}
