import { describe, expect, it, vi } from 'vitest';
import { RefreshUserSessionUseCase } from '../../../../src/application/user/refresh-user-session.use-case';
import { InvalidTokenError } from '../../../../src/application/user/errors/invalid-token.error';
import { UserRepository } from '../../../../src/application/user/user-repository';
import { TokenService } from '../../../../src/application/user/token-service';
import { User } from '../../../../src/domain/user/user';

function buildUserRepository(overrides: Partial<UserRepository> = {}): UserRepository {
  return {
    findByEmail: vi.fn().mockResolvedValue(null),
    findById: vi.fn().mockResolvedValue(null),
    save: vi.fn().mockResolvedValue(undefined),
    ...overrides,
  };
}

function buildTokenService(overrides: Partial<TokenService> = {}): TokenService {
  return {
    generateTokenPair: vi.fn().mockReturnValue({ accessToken: 'new-access-token', refreshToken: 'new-refresh-token' }),
    verifyAccessToken: vi.fn(),
    verifyRefreshToken: vi.fn().mockReturnValue({ sub: 'user-id' }),
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
  it('issues a new token pair for a valid refresh token belonging to an existing user', async () => {
    const userRepository = buildUserRepository({ findById: vi.fn().mockResolvedValue(existingUser) });
    const tokenService = buildTokenService();
    const useCase = new RefreshUserSessionUseCase(userRepository, tokenService);

    const tokens = await useCase.execute('valid-refresh-token');

    expect(tokenService.verifyRefreshToken).toHaveBeenCalledWith('valid-refresh-token');
    expect(userRepository.findById).toHaveBeenCalledWith('user-id');
    expect(tokenService.generateTokenPair).toHaveBeenCalledWith('user-id');
    expect(tokens).toEqual({ accessToken: 'new-access-token', refreshToken: 'new-refresh-token' });
  });

  it('rejects an invalid or expired refresh token', async () => {
    const userRepository = buildUserRepository();
    const tokenService = buildTokenService({
      verifyRefreshToken: vi.fn().mockImplementation(() => {
        throw new InvalidTokenError();
      }),
    });
    const useCase = new RefreshUserSessionUseCase(userRepository, tokenService);

    await expect(useCase.execute('invalid-refresh-token')).rejects.toThrow(InvalidTokenError);
    expect(userRepository.findById).not.toHaveBeenCalled();
  });

  it('rejects a refresh token whose user no longer exists', async () => {
    const userRepository = buildUserRepository({ findById: vi.fn().mockResolvedValue(null) });
    const tokenService = buildTokenService();
    const useCase = new RefreshUserSessionUseCase(userRepository, tokenService);

    await expect(useCase.execute('valid-refresh-token')).rejects.toThrow(InvalidTokenError);
    expect(tokenService.generateTokenPair).not.toHaveBeenCalled();
  });
});
