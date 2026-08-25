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
  /**
   * The account's session version at the time this token was minted, compared against the current
   * one so a password reset invalidates every token issued before it in a single write.
   *
   * Optional because tokens issued before this claim existed are still in circulation and carry no
   * version at all; those are read as version 0, which is where every account starts, so nobody is
   * signed out by the deploy that introduces it.
   */
  sessionVersion?: number;
}

export interface TokenService {
  generateTokenPair(userId: string, sessionVersion: number): TokenPair;
  verifyAccessToken(token: string): AccessTokenPayload;
  verifyRefreshToken(token: string): RefreshTokenPayload;
}
