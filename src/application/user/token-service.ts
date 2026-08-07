export interface TokenPair {
  accessToken: string;
  refreshToken: string;
}

export interface AccessTokenPayload {
  sub: string;
}

export interface RefreshTokenPayload {
  sub: string;
  /** Unique id for this refresh token, used for revocation/reuse detection. */
  jti: string;
  /** Unix timestamp (seconds) the token expires at, used to size the revocation TTL. */
  exp: number;
}

export interface TokenService {
  generateTokenPair(userId: string): TokenPair;
  verifyAccessToken(token: string): AccessTokenPayload;
  verifyRefreshToken(token: string): RefreshTokenPayload;
}
