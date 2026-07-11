import jwt, { SignOptions } from 'jsonwebtoken';
import { AccessTokenPayload, TokenPair, TokenService } from '../../application/user/token-service';
import { InvalidTokenError } from '../../application/user/errors/invalid-token.error';

export class JwtTokenService implements TokenService {
  constructor(
    private readonly accessSecret: string,
    private readonly refreshSecret: string,
    private readonly accessExpiresIn: string,
    private readonly refreshExpiresIn: string,
  ) {}

  generateTokenPair(userId: string): TokenPair {
    const accessToken = jwt.sign({ sub: userId, type: 'access' }, this.accessSecret, {
      expiresIn: this.accessExpiresIn,
    } as SignOptions);

    const refreshToken = jwt.sign({ sub: userId, type: 'refresh' }, this.refreshSecret, {
      expiresIn: this.refreshExpiresIn,
    } as SignOptions);

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

  verifyRefreshToken(token: string): AccessTokenPayload {
    try {
      const payload = jwt.verify(token, this.refreshSecret);

      if (typeof payload === 'string' || payload.type !== 'refresh' || typeof payload.sub !== 'string') {
        throw new InvalidTokenError();
      }

      return { sub: payload.sub };
    } catch {
      throw new InvalidTokenError();
    }
  }
}
