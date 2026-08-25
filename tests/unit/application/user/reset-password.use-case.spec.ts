import { describe, expect, it, vi } from 'vitest';
import { ResetPasswordUseCase } from '../../../../src/application/user/reset-password.use-case';
import { InvalidVerificationCodeError } from '../../../../src/application/user/errors/invalid-verification-code.error';
import { UserRepository } from '../../../../src/application/user/user-repository';
import { PasswordHasher } from '../../../../src/application/user/password-hasher';
import { TokenService } from '../../../../src/application/user/token-service';
import { VerificationCodeCheck, VerificationCodeService } from '../../../../src/application/user/verification-code-service';
import { User } from '../../../../src/domain/user/user';

function buildUserRepository(overrides: Partial<UserRepository> = {}): UserRepository {
  return {
    findByEmail: vi.fn().mockResolvedValue(null),
    findById: vi.fn().mockResolvedValue(null),
    save: vi.fn().mockResolvedValue(undefined),
    delete: vi.fn().mockResolvedValue(undefined),
    ...overrides,
  };
}

function buildVerificationCodeService(check: VerificationCodeCheck = 'valid'): VerificationCodeService {
  return {
    issue: vi.fn().mockResolvedValue('123456'),
    consume: vi.fn().mockResolvedValue(check),
  };
}

function buildPasswordHasher(overrides: Partial<PasswordHasher> = {}): PasswordHasher {
  return {
    hash: vi.fn().mockResolvedValue('new-password-hash'),
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
  passwordHash: 'old-password-hash',
  name: 'Jane Doe',
});

describe('ResetPasswordUseCase', () => {
  it('stores the new password hash and signs the user in', async () => {
    const userRepository = buildUserRepository({ findByEmail: vi.fn().mockResolvedValue(existingUser) });
    const passwordHasher = buildPasswordHasher();
    const useCase = new ResetPasswordUseCase(
      userRepository,
      buildVerificationCodeService('valid'),
      passwordHasher,
      buildTokenService(),
    );

    const session = await useCase.execute({
      email: 'parent@example.com',
      code: '123456',
      password: 'A-New-Password',
    });

    expect(passwordHasher.hash).toHaveBeenCalledWith('A-New-Password');
    expect(userRepository.save).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'user-id', passwordHash: 'new-password-hash' }),
    );
    expect(session).toEqual({ userId: 'user-id', accessToken: 'access-token', refreshToken: 'refresh-token' });
  });

  it('bumps the session version and mints the new pair under it, ending only the older sessions', async () => {
    const userRepository = buildUserRepository({ findByEmail: vi.fn().mockResolvedValue(existingUser) });
    const tokenService = buildTokenService();
    const useCase = new ResetPasswordUseCase(
      userRepository,
      buildVerificationCodeService('valid'),
      buildPasswordHasher(),
      tokenService,
    );

    await useCase.execute({ email: 'parent@example.com', code: '123456', password: 'A-New-Password' });

    const savedUser = (userRepository.save as ReturnType<typeof vi.fn>).mock.calls[0][0] as User;
    expect(savedUser.sessionVersion).toBe(existingUser.sessionVersion + 1);
    expect(tokenService.generateTokenPair).toHaveBeenCalledWith('user-id', existingUser.sessionVersion + 1);
  });

  it('consumes a code scoped to the reset flow, so a sign-in code cannot change a password', async () => {
    const userRepository = buildUserRepository({ findByEmail: vi.fn().mockResolvedValue(existingUser) });
    const verificationCodeService = buildVerificationCodeService('valid');
    const useCase = new ResetPasswordUseCase(
      userRepository,
      verificationCodeService,
      buildPasswordHasher(),
      buildTokenService(),
    );

    await useCase.execute({ email: 'parent@example.com', code: '123456', password: 'A-New-Password' });

    expect(verificationCodeService.consume).toHaveBeenCalledWith('password-reset', 'parent@example.com', '123456');
  });

  it.each<VerificationCodeCheck>(['invalid', 'not-found', 'too-many-attempts'])(
    'leaves the password untouched for a %s code',
    async (check) => {
      const userRepository = buildUserRepository({ findByEmail: vi.fn().mockResolvedValue(existingUser) });
      const useCase = new ResetPasswordUseCase(
        userRepository,
        buildVerificationCodeService(check),
        buildPasswordHasher(),
        buildTokenService(),
      );

      await expect(
        useCase.execute({ email: 'parent@example.com', code: '000000', password: 'A-New-Password' }),
      ).rejects.toThrow(InvalidVerificationCodeError);
      expect(userRepository.save).not.toHaveBeenCalled();
    },
  );
});
