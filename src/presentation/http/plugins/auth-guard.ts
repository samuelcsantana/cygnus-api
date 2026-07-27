import { FastifyReply, FastifyRequest } from 'fastify';
import { TokenService } from '../../../application/user/token-service';
import { InvalidTokenError } from '../../../application/user/errors/invalid-token.error';

declare module 'fastify' {
  interface FastifyRequest {
    userId: string;
  }
}

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
  };
}
