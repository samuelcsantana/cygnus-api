import jwt from 'jsonwebtoken';
import { describe, expect, it } from 'vitest';
import { JwtTokenService } from '../../../../src/infrastructure/security/jwt-token.service';
import { InvalidTokenError } from '../../../../src/application/user/errors/invalid-token.error';

describe('JwtTokenService', () => {
  const ACCESS_SECRET = 'access-secret-for-tests';
  const REFRESH_SECRET = 'refresh-secret-for-tests';
  const service = new JwtTokenService(ACCESS_SECRET, REFRESH_SECRET, '15m', '7d');

  it('round-trips a pair it issued', () => {
    const { accessToken, refreshToken } = service.generateTokenPair('user-1', 3);

    expect(service.verifyAccessToken(accessToken)).toEqual({ sub: 'user-1' });
    expect(service.verifyRefreshToken(refreshToken)).toMatchObject({ sub: 'user-1', sessionVersion: 3 });
  });

  it('rejects a token that is not a JWT at all', () => {
    expect(() => service.verifyAccessToken('not-a-token')).toThrow(InvalidTokenError);
    expect(() => service.verifyRefreshToken('not-a-token')).toThrow(InvalidTokenError);
  });

  // The two kinds are told apart by `type` as well as by secret, so a deployment that ever shares
  // one secret still cannot accept a refresh token where an access token is expected, or the
  // other way round.
  it('rejects a refresh-typed payload as an access token, even under the access secret', () => {
    const token = jwt.sign({ sub: 'user-1', type: 'refresh' }, ACCESS_SECRET);

    expect(() => service.verifyAccessToken(token)).toThrow(InvalidTokenError);
  });

  it('rejects an access-typed payload as a refresh token, even under the refresh secret', () => {
    const token = jwt.sign({ sub: 'user-1', type: 'access', jti: 'jti-1' }, REFRESH_SECRET, { expiresIn: '7d' });

    expect(() => service.verifyRefreshToken(token)).toThrow(InvalidTokenError);
  });

  it('rejects an access token without a string subject', () => {
    const token = jwt.sign({ sub: 42, type: 'access' } as unknown as object, ACCESS_SECRET);

    expect(() => service.verifyAccessToken(token)).toThrow(InvalidTokenError);
  });

  // Without a jti the token could not be revoked on its own, so logout and rotation would have
  // nothing to put on the deny list.
  it('rejects a refresh token without a jti', () => {
    const token = jwt.sign({ sub: 'user-1', type: 'refresh' }, REFRESH_SECRET, { expiresIn: '7d' });

    expect(() => service.verifyRefreshToken(token)).toThrow(InvalidTokenError);
  });

  it('rejects a refresh token whose session version is not a number', () => {
    const token = jwt.sign({ sub: 'user-1', type: 'refresh', jti: 'jti-1', sessionVersion: '3' }, REFRESH_SECRET, { expiresIn: '7d' });

    expect(() => service.verifyRefreshToken(token)).toThrow(InvalidTokenError);
  });

  it('rejects a token signed with the other secret', () => {
    const { refreshToken } = service.generateTokenPair('user-1', 0);

    expect(() => service.verifyAccessToken(refreshToken)).toThrow(InvalidTokenError);
  });
});
