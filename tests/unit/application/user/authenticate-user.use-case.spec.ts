import { describe, expect, it, vi } from 'vitest';
import { AuthenticateUserUseCase } from '../../../../src/application/user/authenticate-user.use-case';
import { InvalidCredentialsError } from '../../../../src/application/user/errors/invalid-credentials.error';
import { UserRepository } from '../../../../src/application/user/user-repository';
import { PasswordHasher } from '../../../../src/application/user/password-hasher';
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

function buildPasswordHasher(overrides: Partial<PasswordHasher> = {}): PasswordHasher {
  return {
    hash: vi.fn().mockResolvedValue('hashed-password'),
    compare: vi.fn().mockResolvedValue(true),
    ...overrides,
  };
}

function buildTokenService(overrides: Partial<TokenService> = {}): TokenService {
  return {
    generateTokenPair: vi.fn().mockReturnValue({ accessToken: 'access-token', refreshToken: 'refresh-token' }),
    verifyAccessToken: vi.fn(),
    verifyRefreshToken: vi.fn(),
    ...overrides,
  };
}

const existingUser = User.create({
  id: 'user-id',
  email: 'parent@example.com',
  passwordHash: 'hashed-password',
  name: 'Jane Doe',
});

describe('AuthenticateUserUseCase', () => {
  it('returns an access and refresh token pair for valid credentials', async () => {
    const userRepository = buildUserRepository({ findByEmail: vi.fn().mockResolvedValue(existingUser) });
    const passwordHasher = buildPasswordHasher();
    const tokenService = buildTokenService();
    const useCase = new AuthenticateUserUseCase(userRepository, passwordHasher, tokenService);

    const tokens = await useCase.execute({ email: 'parent@example.com', password: 'correct-password' });

    expect(passwordHasher.compare).toHaveBeenCalledWith('correct-password', existingUser.passwordHash);
    expect(tokenService.generateTokenPair).toHaveBeenCalledWith('user-id');
    expect(tokens).toEqual({ accessToken: 'access-token', refreshToken: 'refresh-token' });
  });

  it('rejects authentication when the email does not exist', async () => {
    const userRepository = buildUserRepository();
    const passwordHasher = buildPasswordHasher();
    const tokenService = buildTokenService();
    const useCase = new AuthenticateUserUseCase(userRepository, passwordHasher, tokenService);

    await expect(useCase.execute({ email: 'unknown@example.com', password: 'anything' })).rejects.toThrow(
      InvalidCredentialsError,
    );
    expect(tokenService.generateTokenPair).not.toHaveBeenCalled();
  });

  it('rejects authentication when the password is incorrect', async () => {
    const userRepository = buildUserRepository({ findByEmail: vi.fn().mockResolvedValue(existingUser) });
    const passwordHasher = buildPasswordHasher({ compare: vi.fn().mockResolvedValue(false) });
    const tokenService = buildTokenService();
    const useCase = new AuthenticateUserUseCase(userRepository, passwordHasher, tokenService);

    await expect(
      useCase.execute({ email: 'parent@example.com', password: 'wrong-password' }),
    ).rejects.toThrow(InvalidCredentialsError);
    expect(tokenService.generateTokenPair).not.toHaveBeenCalled();
  });
});
