import type { FastifyReply } from 'fastify';
import { env } from '../../../shared/config/env';
import { parseDurationToSeconds } from '../../../shared/utils/parse-duration';

export const ACCESS_TOKEN_COOKIE = 'access_token';
export const REFRESH_TOKEN_COOKIE = 'refresh_token';

export function setAuthCookies(reply: FastifyReply, accessToken: string, refreshToken: string): void {
  const cookieOptions = {
    httpOnly: true,
    secure: env.secureCookies,
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

export function clearAuthCookies(reply: FastifyReply): void {
  reply.clearCookie(ACCESS_TOKEN_COOKIE, { path: '/' });
  reply.clearCookie(REFRESH_TOKEN_COOKIE, { path: '/' });
}
