import type { App } from '../../../infrastructure/http/build-app';
import { RegisterUserUseCase } from '../../../application/user/register-user.use-case';
import { AuthenticateUserUseCase } from '../../../application/user/authenticate-user.use-case';
import { RefreshUserSessionUseCase } from '../../../application/user/refresh-user-session.use-case';
import { EmailAlreadyInUseError } from '../../../application/user/errors/email-already-in-use.error';
import { InvalidCredentialsError } from '../../../application/user/errors/invalid-credentials.error';
import { InvalidTokenError } from '../../../application/user/errors/invalid-token.error';
import { DomainError } from '../../../shared/errors/domain-error';
import { PrismaUserRepository } from '../../../infrastructure/database/repositories/prisma-user.repository';
import { BcryptPasswordHasher } from '../../../infrastructure/security/bcrypt-password-hasher';
import { tokenService } from '../../../infrastructure/security/token-service.instance';
import { tokenRevocationService } from '../../../infrastructure/security/token-revocation-service.instance';
import { revokeRefreshTokenIfPresent } from '../../../infrastructure/security/revoke-refresh-token';
import { prisma } from '../../../infrastructure/database/prisma-client';
import { env } from '../../../shared/config/env';
import { authenticate } from '../plugins/authenticate';
import { REFRESH_TOKEN_COOKIE, clearAuthCookies, setAuthCookies } from '../utils/auth-cookies';
import {
  authErrorResponseSchema,
  authSuccessResponseSchema,
  currentUserResponseSchema,
  loginBodySchema,
  registerBodySchema,
  registerResponseSchema,
} from '../schemas/auth.schema';

// Tighter than the global 100/min (build-app.ts) — these routes are the highest-value brute-force
// targets (credential stuffing on login, account enumeration on register, token guessing on refresh).
// Relaxed under NODE_ENV=test: the integration suite legitimately registers/logs in far more than
// 10 times per minute across a single spec file sharing one in-memory rate-limit store.
const AUTH_RATE_LIMIT = { max: env.NODE_ENV === 'test' ? 1000 : 10, timeWindow: '1 minute' };

export async function authRoutes(app: App) {
  const userRepository = new PrismaUserRepository(prisma);
  const passwordHasher = new BcryptPasswordHasher();
  const registerUserUseCase = new RegisterUserUseCase(userRepository, passwordHasher);
  const authenticateUserUseCase = new AuthenticateUserUseCase(userRepository, passwordHasher, tokenService);
  const refreshUserSessionUseCase = new RefreshUserSessionUseCase(userRepository, tokenService, tokenRevocationService);

  app.route({
    method: 'POST',
    url: '/auth/register',
    config: { rateLimit: AUTH_RATE_LIMIT },
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
    config: { rateLimit: AUTH_RATE_LIMIT },
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
    url: '/auth/refresh',
    config: { rateLimit: AUTH_RATE_LIMIT },
    schema: {
      tags: ['Auth'],
      summary: "Rotate the authenticated user's session",
      description:
        'Reads the refresh_token cookie, validates it, and — if still valid and the user still exists — issues a new access/refresh token pair as HTTP-only cookies. Returns 401 if the cookie is missing, expired, or invalid, which the frontend should treat as a hard session expiry and redirect to /login.',
      response: {
        200: authSuccessResponseSchema,
        401: authErrorResponseSchema,
        500: authErrorResponseSchema,
      },
    },
    handler: async (request, reply) => {
      const refreshToken = request.cookies[REFRESH_TOKEN_COOKIE];

      if (!refreshToken) {
        return reply.status(401).send({ status: 'error', message: 'Authentication required' });
      }

      try {
        const { accessToken, refreshToken: newRefreshToken } = await refreshUserSessionUseCase.execute(refreshToken);

        setAuthCookies(reply, accessToken, newRefreshToken);

        request.log.info('auth.refresh_succeeded');

        return reply.status(200).send({ status: 'ok', message: 'Session refreshed successfully' });
      } catch (error) {
        if (error instanceof InvalidTokenError) {
          clearAuthCookies(reply);
          return reply.status(401).send({ status: 'error', message: error.message });
        }

        throw error;
      }
    },
  });

  app.route({
    method: 'GET',
    url: '/auth/me',
    preHandler: authenticate,
    schema: {
      tags: ['Auth'],
      summary: 'Get the authenticated user',
      description: "Returns the currently authenticated user's profile, resolved from the access_token cookie.",
      response: {
        200: currentUserResponseSchema,
        401: authErrorResponseSchema,
        500: authErrorResponseSchema,
      },
    },
    handler: async (request, reply) => {
      const user = await userRepository.findById(request.userId);

      if (!user) {
        return reply.status(401).send({ status: 'error', message: 'Authentication required' });
      }

      return reply.status(200).send({
        id: user.id,
        email: user.email,
        name: user.name,
        createdAt: user.createdAt.toISOString(),
      });
    },
  });

  app.route({
    method: 'POST',
    url: '/auth/logout',
    schema: {
      tags: ['Auth'],
      summary: 'Log out the current user',
      description:
        'Clears the access and refresh token cookies, and revokes the refresh token server-side so a copy ' +
        'leaked before logout can no longer be used to refresh the session.',
      response: {
        200: authSuccessResponseSchema,
        500: authErrorResponseSchema,
      },
    },
    handler: async (request, reply) => {
      await revokeRefreshTokenIfPresent(request.cookies[REFRESH_TOKEN_COOKIE]);

      clearAuthCookies(reply);

      request.log.info('auth.logout_succeeded');

      return reply.status(200).send({ status: 'ok', message: 'Logged out successfully' });
    },
  });
}
