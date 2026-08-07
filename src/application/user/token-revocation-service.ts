export interface TokenRevocationService {
  /** Denylists a refresh token's jti for ttlSeconds (its remaining lifetime). */
  revoke(jti: string, ttlSeconds: number): Promise<void>;
  isRevoked(jti: string): Promise<boolean>;
}
