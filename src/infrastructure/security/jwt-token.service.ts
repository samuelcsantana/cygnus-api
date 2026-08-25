import { randomUUID } from 'node:crypto';
import jwt, { SignOptions } from 'jsonwebtoken';
import { AccessTokenPayload, RefreshTokenPayload, TokenPair, TokenService } from '../../application/user/token-service';
import { InvalidTokenError } from '../../application/user/errors/invalid-token.error';

export class JwtTokenService implements TokenService {
  constructor(
    private readonly accessSecret: string,
    private readonly refreshSecret: string,
    private readonly accessExpiresIn: string,
    private readonly refreshExpiresIn: string,
  ) {}

  generateTokenPair(userId: string, sessionVersion: number): TokenPair {
    const accessToken = jwt.sign({ sub: userId, type: 'access' }, this.accessSecret, {
      expiresIn: this.accessExpiresIn,
    } as SignOptions);

    // jti identifies this refresh token individually so a single one can be revoked (logout,
    // rotation) without invalidating every session the user has; sessionVersion is the opposite
    // handle — it invalidates all of them at once, without the server keeping a list.
    const refreshToken = jwt.sign(
      { sub: userId, type: 'refresh', jti: randomUUID(), sessionVersion },
      this.refreshSecret,
      { expiresIn: this.refreshExpiresIn } as SignOptions,
    );

    return { accessToken, refreshToken };
  }

  verifyAccessToken(token: string): AccessTokenPayload {
    try {
      const payload = jwt.verify(token, this.accessSecret);

      if (typeof payload === 'string' || payload.type !== 'access' || typeof payload.sub !== 'string') {
        throw new InvalidTokenError();
      }

      return { sub: payload.sub };
    } catch {
      throw new InvalidTokenError();
    }
  }

  verifyRefreshToken(token: string): RefreshTokenPayload {
    try {
      const payload = jwt.verify(token, this.refreshSecret);

      if (
        typeof payload === 'string' ||
        payload.type !== 'refresh' ||
        typeof payload.sub !== 'string' ||
        typeof payload.jti !== 'string' ||
        typeof payload.exp !== 'number' ||
        (payload.sessionVersion !== undefined && typeof payload.sessionVersion !== 'number')
      ) {
        throw new InvalidTokenError();
      }

      return { sub: payload.sub, jti: payload.jti, exp: payload.exp, sessionVersion: payload.sessionVersion };
    } catch {
      throw new InvalidTokenError();
    }
  }
}
