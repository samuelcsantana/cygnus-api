import pino from 'pino';
import { env } from '../config/env';

export const logger = pino({
  serializers: {
    // OAuth callback query strings contain single-use authorization codes.
    req(request) { return { method: request.method, url: request.url?.split('?')[0], remoteAddress: request.ip }; },
  },
  level: env.NODE_ENV === 'test' ? 'silent' : 'info',
  transport:
    env.NODE_ENV === 'development'
      ? { target: 'pino-pretty', options: { colorize: true, translateTime: 'HH:MM:ss', ignore: 'pid,hostname' } }
      : undefined,
});
