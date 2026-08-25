import type { App } from '../../../infrastructure/http/build-app';
import { RegisterUserUseCase } from '../../../application/user/register-user.use-case';
import { AuthenticateUserUseCase } from '../../../application/user/authenticate-user.use-case';
import { RefreshUserSessionUseCase } from '../../../application/user/refresh-user-session.use-case';
import { RequestVerificationCodeUseCase } from '../../../application/user/request-verification-code.use-case';
import { VerifyPasswordlessCodeUseCase } from '../../../application/user/verify-passwordless-code.use-case';
import { ResetPasswordUseCase } from '../../../application/user/reset-password.use-case';
import { EmailAlreadyInUseError } from '../../../application/user/errors/email-already-in-use.error';
import { InvalidCredentialsError } from '../../../application/user/errors/invalid-credentials.error';
import { InvalidTokenError } from '../../../application/user/errors/invalid-token.error';
import { InvalidVerificationCodeError } from '../../../application/user/errors/invalid-verification-code.error';
import { DomainError } from '../../../shared/errors/domain-error';
import { PrismaUserRepository } from '../../../infrastructure/database/repositories/prisma-user.repository';
import { BcryptPasswordHasher } from '../../../infrastructure/security/bcrypt-password-hasher';
import { tokenService } from '../../../infrastructure/security/token-service.instance';
import { tokenRevocationService } from '../../../infrastructure/security/token-revocation-service.instance';
import { verificationCodeService } from '../../../infrastructure/security/verification-code-service.instance';
import { revokeRefreshTokenIfPresent } from '../../../infrastructure/security/revoke-refresh-token';
import { emailService } from '../../../infrastructure/email/email-service.instance';
import { auditLogger } from '../../../infrastructure/audit/audit-logger.instance';
import { prisma } from '../../../infrastructure/database/prisma-client';
import { env } from '../../../shared/config/env';
import { authenticate } from '../plugins/authenticate';
import { REFRESH_TOKEN_COOKIE, clearAuthCookies, setAuthCookies } from '../utils/auth-cookies';
import {
  assistedRequestBodySchema,
  authErrorResponseSchema,
  authSuccessResponseSchema,
  currentUserResponseSchema,
  loginBodySchema,
  passwordResetVerifyBodySchema,
  passwordlessVerifyBodySchema,
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

  // EmailService no-ops when RESEND_API_KEY is unset — the default everywhere except production —
  // so off-production the issued code is written to the log instead. Without that escape hatch the
  // assisted flows cannot be exercised locally or in CI at all, and they fail in the one way they
  // are built never to show: a 200 with nothing behind it.
  const logIssuedCode = env.NODE_ENV !== 'production';

  const requestPasswordlessCodeUseCase = new RequestVerificationCodeUseCase(
    userRepository,
    verificationCodeService,
    'passwordless',
    (to, code) => emailService.sendPasswordlessCodeEmail(to, code),
    logIssuedCode,
  );
  const requestPasswordResetCodeUseCase = new RequestVerificationCodeUseCase(
    userRepository,
    verificationCodeService,
    'password-reset',
    (to, code) => emailService.sendPasswordResetCodeEmail(to, code),
    logIssuedCode,
  );
  const verifyPasswordlessCodeUseCase = new VerifyPasswordlessCodeUseCase(
    userRepository,
    verificationCodeService,
    tokenService,
  );
  const resetPasswordUseCase = new ResetPasswordUseCase(
    userRepository,
    verificationCodeService,
    passwordHasher,
    tokenService,
  );

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
          emailNotificationsEnabled: user.emailNotificationsEnabled,
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
        emailNotificationsEnabled: user.emailNotificationsEnabled,
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

  // ---------------------------------------------------------------------------------------------
  // Assisted flows: proving control of an e-mail address with a 6-digit code, instead of knowing a
  // password. Two shapes of the same machine — sign in without a password, and reset a forgotten
  // one — each a `request` that mails a code and a `verify` that ends in a session.
  //
  // Both `request` routes answer 200 with an identical body whether or not the address has an
  // account, whether or not the mail went out, and whether or not the throttle swallowed it. The
  // response is a receipt for the request, never a statement about the account, or this pair of
  // endpoints would become a way to ask which e-mails are registered in a children's health app.
  //
  // Neither verify route needs the CSRF header: the double-submit check lives in createAuthGuard,
  // which only runs on authenticated routes, and these are public exactly like /auth/login.
  // ---------------------------------------------------------------------------------------------

  const ASSISTED_REQUEST_ACCEPTED = 'If that email has an account, a code is on its way';

  app.route({
    method: 'POST',
    url: '/auth/passwordless/request',
    config: { rateLimit: AUTH_RATE_LIMIT },
    schema: {
      tags: ['Auth'],
      summary: 'Request a sign-in code',
      description:
        'Mails a 6-digit code that can be exchanged for a session at /auth/passwordless/verify. Always answers 200 ' +
        'with the same body, including for an address that has no account, so the endpoint cannot be used to find ' +
        'out which e-mails are registered. The code is valid for 10 minutes, is single-use, and allows 5 attempts.',
      body: assistedRequestBodySchema,
      response: {
        200: authSuccessResponseSchema,
        400: authErrorResponseSchema,
        429: authErrorResponseSchema,
        500: authErrorResponseSchema,
      },
    },
    handler: async (request, reply) => {
      await requestPasswordlessCodeUseCase.execute(request.body);

      return reply.status(200).send({ status: 'ok', message: ASSISTED_REQUEST_ACCEPTED });
    },
  });

  app.route({
    method: 'POST',
    url: '/auth/passwordless/verify',
    config: { rateLimit: AUTH_RATE_LIMIT },
    schema: {
      tags: ['Auth'],
      summary: 'Exchange a sign-in code for a session',
      description:
        'Consumes the code mailed by /auth/passwordless/request and sets the same session cookies /auth/login does. ' +
        'A wrong, expired, already-used or over-attempted code — and an address with no account — all answer 401 ' +
        'with the same message, so nothing can be inferred from the failure.',
      body: passwordlessVerifyBodySchema,
      response: {
        200: authSuccessResponseSchema,
        400: authErrorResponseSchema,
        401: authErrorResponseSchema,
        429: authErrorResponseSchema,
        500: authErrorResponseSchema,
      },
    },
    handler: async (request, reply) => {
      try {
        const { userId, accessToken, refreshToken } = await verifyPasswordlessCodeUseCase.execute(request.body);

        setAuthCookies(reply, accessToken, refreshToken);

        request.log.info({ userId }, 'auth.passwordless_login_succeeded');

        auditLogger.log({
          userId,
          action: 'auth.passwordless_login',
          resourceType: 'User',
          resourceId: userId,
        });

        return reply.status(200).send({ status: 'ok', message: 'Authenticated successfully' });
      } catch (error) {
        if (error instanceof InvalidVerificationCodeError) {
          return reply.status(401).send({ status: 'error', message: error.message });
        }

        throw error;
      }
    },
  });

  app.route({
    method: 'POST',
    url: '/auth/password-reset/request',
    config: { rateLimit: AUTH_RATE_LIMIT },
    schema: {
      tags: ['Auth'],
      summary: 'Request a password reset code',
      description:
        'Mails a 6-digit code that can be exchanged for a new password at /auth/password-reset/verify. Answers 200 ' +
        'identically for every address, registered or not. The code is valid for 10 minutes, is single-use, allows ' +
        '5 attempts, and is scoped to this flow — a sign-in code cannot be used to change a password.',
      body: assistedRequestBodySchema,
      response: {
        200: authSuccessResponseSchema,
        400: authErrorResponseSchema,
        429: authErrorResponseSchema,
        500: authErrorResponseSchema,
      },
    },
    handler: async (request, reply) => {
      await requestPasswordResetCodeUseCase.execute(request.body);

      return reply.status(200).send({ status: 'ok', message: ASSISTED_REQUEST_ACCEPTED });
    },
  });

  app.route({
    method: 'POST',
    url: '/auth/password-reset/verify',
    config: { rateLimit: AUTH_RATE_LIMIT },
    schema: {
      tags: ['Auth'],
      summary: 'Set a new password with a reset code',
      description:
        'Consumes the code mailed by /auth/password-reset/request, replaces the password, and signs the user in with ' +
        'fresh cookies. Every other session is ended: refresh tokens issued before the reset stop working, so a ' +
        'device the user was resetting *because of* keeps no way back in. Access tokens already issued elsewhere ' +
        'still work until they expire (15 minutes). Failures answer 401 with the same message as any bad code.',
      body: passwordResetVerifyBodySchema,
      response: {
        200: authSuccessResponseSchema,
        400: authErrorResponseSchema,
        401: authErrorResponseSchema,
        429: authErrorResponseSchema,
        500: authErrorResponseSchema,
      },
    },
    handler: async (request, reply) => {
      try {
        const { userId, accessToken, refreshToken } = await resetPasswordUseCase.execute(request.body);

        setAuthCookies(reply, accessToken, refreshToken);

        request.log.info({ userId }, 'auth.password_reset_succeeded');

        auditLogger.log({
          userId,
          action: 'auth.password_reset',
          resourceType: 'User',
          resourceId: userId,
        });

        return reply.status(200).send({ status: 'ok', message: 'Password updated successfully' });
      } catch (error) {
        if (error instanceof InvalidVerificationCodeError) {
          return reply.status(401).send({ status: 'error', message: error.message });
        }

        throw error;
      }
    },
  });
}
