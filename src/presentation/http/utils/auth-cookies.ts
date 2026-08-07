import { randomBytes } from 'node:crypto';
import type { FastifyReply } from 'fastify';
import { env } from '../../../shared/config/env';
import { parseDurationToSeconds } from '../../../shared/utils/parse-duration';

export const ACCESS_TOKEN_COOKIE = 'access_token';
export const REFRESH_TOKEN_COOKIE = 'refresh_token';
// Double-submit CSRF cookie: deliberately NOT HttpOnly so the frontend can read it and echo it
// back in the X-CSRF-Token header on state-changing requests. It carries no session data on its
// own (just a random value), so it stays safe to expose to JS.
export const CSRF_TOKEN_COOKIE = 'csrf_token';

export function setAuthCookies(reply: FastifyReply, accessToken: string, refreshToken: string): void {
  const cookieOptions = {
    secure: env.secureCookies,
    sameSite: 'strict' as const,
    path: '/',
  };

  reply.setCookie(ACCESS_TOKEN_COOKIE, accessToken, {
    ...cookieOptions,
    httpOnly: true,
    maxAge: parseDurationToSeconds(env.JWT_ACCESS_EXPIRES_IN),
  });

  reply.setCookie(REFRESH_TOKEN_COOKIE, refreshToken, {
    ...cookieOptions,
    httpOnly: true,
    maxAge: parseDurationToSeconds(env.JWT_REFRESH_EXPIRES_IN),
  });

  reply.setCookie(CSRF_TOKEN_COOKIE, randomBytes(32).toString('hex'), {
    ...cookieOptions,
    httpOnly: false,
    maxAge: parseDurationToSeconds(env.JWT_REFRESH_EXPIRES_IN),
  });
}

export function clearAuthCookies(reply: FastifyReply): void {
  reply.clearCookie(ACCESS_TOKEN_COOKIE, { path: '/' });
  reply.clearCookie(REFRESH_TOKEN_COOKIE, { path: '/' });
  reply.clearCookie(CSRF_TOKEN_COOKIE, { path: '/' });
}
