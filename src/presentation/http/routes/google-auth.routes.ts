import { randomBytes } from 'node:crypto';
import { z } from 'zod';
import { GoogleSignInError } from '../../../application/user/google-identity';
import { SignInWithGoogleUseCase } from '../../../application/user/sign-in-with-google.use-case';
import { prisma } from '../../../infrastructure/database/prisma-client';
import { PrismaGoogleIdentityRepository } from '../../../infrastructure/database/repositories/prisma-google-identity.repository';
import { BcryptPasswordHasher } from '../../../infrastructure/security/bcrypt-password-hasher';
import { googleOAuthService } from '../../../infrastructure/security/google-oauth.service';
import { tokenService } from '../../../infrastructure/security/token-service.instance';
import { auditLogger } from '../../../infrastructure/audit/audit-logger.instance';
import type { App } from '../../../infrastructure/http/build-app';
import { env } from '../../../shared/config/env';
import { setAuthCookies } from '../utils/auth-cookies';
import { authErrorResponseSchema } from '../schemas/auth.schema';

const COOKIE = 'google_oauth';
const callbackSchema = z.object({
  state: z.string().max(128).optional(), code: z.string().max(4096).optional(),
  error: z.string().max(128).optional(),
});
const browserValue = z.string().regex(/^[A-Za-z0-9_-]{43}$/);

export async function googleAuthRoutes(app: App) {
  const signIn = new SignInWithGoogleUseCase(new PrismaGoogleIdentityRepository(prisma), new BcryptPasswordHasher(), tokenService);
  const rateLimit = { max: env.NODE_ENV === 'test' ? 1000 : 10, timeWindow: '1 minute' };

  app.get('/auth/google/status', {
    schema: { tags: ['Auth'], summary: 'Check Google sign-in availability', response: { 200: z.object({ enabled: z.boolean() }), 429: authErrorResponseSchema, 500: authErrorResponseSchema } },
  }, async (_request, reply) => reply.header('Cache-Control', 'no-store').send({ enabled: googleOAuthService.enabled }));

  app.post('/auth/google/start', {
    config: { rateLimit },
    schema: {
      tags: ['Auth'], summary: 'Begin Google sign-in',
      description: 'Creates a ten-minute, browser-bound OAuth transaction with state, nonce and PKCE. Requires the configured frontend Origin header.',
      response: { 200: z.object({ url: z.string().url() }), 400: authErrorResponseSchema, 403: authErrorResponseSchema, 429: authErrorResponseSchema, 503: authErrorResponseSchema, 500: authErrorResponseSchema },
    },
  }, async (request, reply) => {
    reply.header('Cache-Control', 'no-store');
    if (request.headers.origin !== new URL(env.CORS_ORIGIN).origin) {
      return reply.status(403).send({ status: 'error', message: 'Origin not allowed' });
    }
    if (!googleOAuthService.enabled) return reply.status(503).send({ status: 'error', message: 'Google sign-in is unavailable' });
    const browser = randomBytes(32).toString('base64url');
    const url = await googleOAuthService.start(browser);
    // Only the transaction cookie is Lax: Google's top-level callback must send
    // it. The actual application session continues to use SameSite=Strict.
    reply.setCookie(COOKIE, browser, { httpOnly: true, secure: env.secureCookies, sameSite: 'lax', path: '/', maxAge: 600 });
    return { url };
  });

  app.get('/auth/google/callback', {
    config: { rateLimit },
    schema: {
      tags: ['Auth'], summary: 'Complete Google sign-in',
      description: 'Consumes the browser-bound transaction, validates the Google ID token, and sets the regular session cookies. Redirects to a fixed frontend completion page; never returns tokens in a URL.',
      querystring: callbackSchema,
      response: { 302: z.string(), 400: authErrorResponseSchema, 429: authErrorResponseSchema, 500: authErrorResponseSchema },
    },
  }, async (request, reply) => {
    reply.header('Cache-Control', 'no-store').header('Referrer-Policy', 'no-referrer');
    reply.clearCookie(COOKIE, { path: '/', httpOnly: true, secure: env.secureCookies, sameSite: 'lax' });
    const destination = new URL('/auth/google/complete', env.CORS_ORIGIN);
    try {
      const browser = browserValue.safeParse(request.cookies[COOKIE]);
      const state = browserValue.safeParse(request.query.state);
      if (!googleOAuthService.enabled || !browser.success || !state.success) throw new GoogleSignInError();
      const identity = await googleOAuthService.complete(state.data, browser.data, request.query.error ? undefined : request.query.code);
      const session = await signIn.execute(identity);
      setAuthCookies(reply, session.accessToken, session.refreshToken);
      auditLogger.log({ userId: session.userId, action: 'auth.google_login', resourceType: 'User', resourceId: session.userId });
    } catch (error) {
      const reason = error instanceof GoogleSignInError ? error.reason : 'failed';
      // OAuth client errors can contain authorization codes, tokens and secrets.
      request.log.warn({ reason }, 'auth.google_login_rejected');
      destination.searchParams.set('error', reason);
    }
    return reply.redirect(destination.toString());
  });
}
