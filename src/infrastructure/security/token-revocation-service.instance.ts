import { redis } from '../cache/redis-client';
import { RedisTokenRevocationService } from './redis-token-revocation.service';

export const tokenRevocationService = new RedisTokenRevocationService(redis);
