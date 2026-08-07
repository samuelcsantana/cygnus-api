import type Redis from 'ioredis';
import { TokenRevocationService } from '../../application/user/token-revocation-service';

const REVOKED_REFRESH_KEY_PREFIX = 'revoked-refresh:';

export class RedisTokenRevocationService implements TokenRevocationService {
  constructor(private readonly redis: Redis) {}

  async revoke(jti: string, ttlSeconds: number): Promise<void> {
    await this.redis.set(`${REVOKED_REFRESH_KEY_PREFIX}${jti}`, '1', 'EX', ttlSeconds);
  }

  async isRevoked(jti: string): Promise<boolean> {
    const value = await this.redis.get(`${REVOKED_REFRESH_KEY_PREFIX}${jti}`);
    return value !== null;
  }
}
