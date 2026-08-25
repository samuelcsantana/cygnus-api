import { env } from '../../shared/config/env';
import { redis } from '../cache/redis-client';
import { RedisVerificationCodeService } from './redis-verification-code.service';

// JWT_ACCESS_SECRET is the *source* the code-hash key is derived from, not the key itself — see
// CODE_HASH_DOMAIN in redis-verification-code.service.ts. Rotating it invalidates outstanding
// codes along with outstanding access tokens, which is the behaviour you would want anyway.
export const verificationCodeService = new RedisVerificationCodeService(redis, env.JWT_ACCESS_SECRET);
