import { describe, expect, it, vi } from 'vitest';
import { VerifyPasswordlessCodeUseCase } from '../../../../src/application/user/verify-passwordless-code.use-case';
import { InvalidVerificationCodeError } from '../../../../src/application/user/errors/invalid-verification-code.error';
import { UserRepository } from '../../../../src/application/user/user-repository';
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

describe('VerifyPasswordlessCodeUseCase', () => {
  it('returns the same token pair a password login would, for a valid code', async () => {
    const userRepository = buildUserRepository({ findByEmail: vi.fn().mockResolvedValue(existingUser) });
    const verificationCodeService = buildVerificationCodeService('valid');
    const tokenService = buildTokenService();
    const useCase = new VerifyPasswordlessCodeUseCase(userRepository, verificationCodeService, tokenService);

    const session = await useCase.execute({ email: 'parent@example.com', code: '123456' });

    expect(verificationCodeService.consume).toHaveBeenCalledWith('passwordless', 'parent@example.com', '123456');
    expect(session).toEqual({ userId: 'user-id', accessToken: 'access-token', refreshToken: 'refresh-token' });
  });

  it.each<VerificationCodeCheck>(['invalid', 'not-found', 'too-many-attempts'])(
    'rejects a %s code with the one indistinguishable error',
    async (check) => {
      const userRepository = buildUserRepository({ findByEmail: vi.fn().mockResolvedValue(existingUser) });
      const verificationCodeService = buildVerificationCodeService(check);
      const tokenService = buildTokenService();
      const useCase = new VerifyPasswordlessCodeUseCase(userRepository, verificationCodeService, tokenService);

      await expect(useCase.execute({ email: 'parent@example.com', code: '000000' })).rejects.toThrow(
        InvalidVerificationCodeError,
      );
      expect(tokenService.generateTokenPair).not.toHaveBeenCalled();
    },
  );

  it('never looks the account up when the code fails, so an unknown address cannot be told apart', async () => {
    const userRepository = buildUserRepository();
    const verificationCodeService = buildVerificationCodeService('not-found');
    const useCase = new VerifyPasswordlessCodeUseCase(userRepository, verificationCodeService, buildTokenService());

    await expect(useCase.execute({ email: 'stranger@example.com', code: '123456' })).rejects.toThrow(
      InvalidVerificationCodeError,
    );
    expect(userRepository.findByEmail).not.toHaveBeenCalled();
  });
});
