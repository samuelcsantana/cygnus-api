import { FastifyReply, FastifyRequest } from 'fastify';
import { TokenService } from '../../../application/user/token-service';
import { InvalidTokenError } from '../../../application/user/errors/invalid-token.error';
import { CSRF_TOKEN_COOKIE } from '../utils/auth-cookies';

declare module 'fastify' {
  interface FastifyRequest {
    userId: string;
  }
}

const CSRF_HEADER = 'x-csrf-token';
const STATE_CHANGING_METHODS = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);

export function createAuthGuard(tokenService: TokenService) {
  return async function authGuard(request: FastifyRequest, reply: FastifyReply): Promise<void> {
    const token = request.cookies.access_token;

    if (!token) {
      return reply.status(401).send({ status: 'error', message: 'Authentication required' });
    }

    try {
      const payload = tokenService.verifyAccessToken(token);
      request.userId = payload.sub;
    } catch (error) {
      if (error instanceof InvalidTokenError) {
        return reply.status(401).send({ status: 'error', message: error.message });
      }

      throw error;
    }

    // Double-submit CSRF check: a cross-site request can ride the SameSite=Strict-protected
    // cookies in same-site-lax edge cases (e.g. top-level GET navigations turned into POSTs by
    // some proxies) or in browsers that don't honor SameSite, but it cannot read this cookie's
    // value to also set it as a header — so a mismatch means the request didn't originate from
    // our own frontend.
    if (STATE_CHANGING_METHODS.has(request.method)) {
      const cookieToken = request.cookies[CSRF_TOKEN_COOKIE];
      const headerToken = request.headers[CSRF_HEADER];

      if (!cookieToken || typeof headerToken !== 'string' || headerToken !== cookieToken) {
        return reply.status(403).send({ status: 'error', message: 'Invalid or missing CSRF token' });
      }
    }
  };
}
