import { describe, expect, it, vi } from 'vitest';
import { RefreshUserSessionUseCase } from '../../../../src/application/user/refresh-user-session.use-case';
import { InvalidTokenError } from '../../../../src/application/user/errors/invalid-token.error';
import { UserRepository } from '../../../../src/application/user/user-repository';
import { TokenService } from '../../../../src/application/user/token-service';
import { TokenRevocationService } from '../../../../src/application/user/token-revocation-service';
import { User } from '../../../../src/domain/user/user';

function buildUserRepository(overrides: Partial<UserRepository> = {}): UserRepository {
  return {
    findByEmail: vi.fn().mockResolvedValue(null),
    findById: vi.fn().mockResolvedValue(null),
    save: vi.fn().mockResolvedValue(undefined),
    ...overrides,
  };
}

const futureExp = Math.floor(Date.now() / 1000) + 7 * 24 * 60 * 60;

function buildTokenService(overrides: Partial<TokenService> = {}): TokenService {
  return {
    generateTokenPair: vi.fn().mockReturnValue({ accessToken: 'new-access-token', refreshToken: 'new-refresh-token' }),
    verifyAccessToken: vi.fn(),
    verifyRefreshToken: vi.fn().mockReturnValue({ sub: 'user-id', jti: 'old-jti', exp: futureExp }),
    ...overrides,
  };
}

function buildTokenRevocationService(overrides: Partial<TokenRevocationService> = {}): TokenRevocationService {
  return {
    revoke: vi.fn().mockResolvedValue(undefined),
    isRevoked: vi.fn().mockResolvedValue(false),
    ...overrides,
  };
}

const existingUser = User.create({
  id: 'user-id',
  email: 'parent@example.com',
  passwordHash: 'hashed-password',
  name: 'Jane Doe',
});

describe('RefreshUserSessionUseCase', () => {
  it('issues a new token pair for a valid, non-revoked refresh token belonging to an existing user', async () => {
    const userRepository = buildUserRepository({ findById: vi.fn().mockResolvedValue(existingUser) });
    const tokenService = buildTokenService();
    const tokenRevocationService = buildTokenRevocationService();
    const useCase = new RefreshUserSessionUseCase(userRepository, tokenService, tokenRevocationService);

    const tokens = await useCase.execute('valid-refresh-token');

    expect(tokenService.verifyRefreshToken).toHaveBeenCalledWith('valid-refresh-token');
    expect(tokenRevocationService.isRevoked).toHaveBeenCalledWith('old-jti');
    expect(userRepository.findById).toHaveBeenCalledWith('user-id');
    expect(tokenService.generateTokenPair).toHaveBeenCalledWith('user-id');
    expect(tokens).toEqual({ accessToken: 'new-access-token', refreshToken: 'new-refresh-token' });
  });

  it('revokes the spent refresh token jti after a successful rotation', async () => {
    const userRepository = buildUserRepository({ findById: vi.fn().mockResolvedValue(existingUser) });
    const tokenService = buildTokenService();
    const tokenRevocationService = buildTokenRevocationService();
    const useCase = new RefreshUserSessionUseCase(userRepository, tokenService, tokenRevocationService);

    await useCase.execute('valid-refresh-token');

    expect(tokenRevocationService.revoke).toHaveBeenCalledWith('old-jti', expect.any(Number));
    const ttl = (tokenRevocationService.revoke as ReturnType<typeof vi.fn>).mock.calls[0][1] as number;
    expect(ttl).toBeGreaterThan(0);
  });

  it('rejects a revoked refresh token, functioning as reuse detection', async () => {
    const userRepository = buildUserRepository({ findById: vi.fn().mockResolvedValue(existingUser) });
    const tokenService = buildTokenService();
    const tokenRevocationService = buildTokenRevocationService({ isRevoked: vi.fn().mockResolvedValue(true) });
    const useCase = new RefreshUserSessionUseCase(userRepository, tokenService, tokenRevocationService);

    await expect(useCase.execute('reused-refresh-token')).rejects.toThrow(InvalidTokenError);
    expect(userRepository.findById).not.toHaveBeenCalled();
    expect(tokenService.generateTokenPair).not.toHaveBeenCalled();
  });

  it('rejects an invalid or expired refresh token', async () => {
    const userRepository = buildUserRepository();
    const tokenService = buildTokenService({
      verifyRefreshToken: vi.fn().mockImplementation(() => {
        throw new InvalidTokenError();
      }),
    });
    const tokenRevocationService = buildTokenRevocationService();
    const useCase = new RefreshUserSessionUseCase(userRepository, tokenService, tokenRevocationService);

    await expect(useCase.execute('invalid-refresh-token')).rejects.toThrow(InvalidTokenError);
    expect(userRepository.findById).not.toHaveBeenCalled();
  });

  it('rejects a refresh token whose user no longer exists', async () => {
    const userRepository = buildUserRepository({ findById: vi.fn().mockResolvedValue(null) });
    const tokenService = buildTokenService();
    const tokenRevocationService = buildTokenRevocationService();
    const useCase = new RefreshUserSessionUseCase(userRepository, tokenService, tokenRevocationService);

    await expect(useCase.execute('valid-refresh-token')).rejects.toThrow(InvalidTokenError);
    expect(tokenService.generateTokenPair).not.toHaveBeenCalled();
  });
});
