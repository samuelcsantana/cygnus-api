import { describe, expect, it, vi } from 'vitest';
import { DeleteUserAccountUseCase } from '../../../../src/application/user/delete-user-account.use-case';
import { IncorrectPasswordError } from '../../../../src/application/user/errors/incorrect-password.error';
import { UserNotFoundError } from '../../../../src/application/user/errors/user-not-found.error';
import { UserRepository } from '../../../../src/application/user/user-repository';
import { PasswordHasher } from '../../../../src/application/user/password-hasher';
import { User } from '../../../../src/domain/user/user';
import { InvalidVerificationCodeError } from '../../../../src/application/user/errors/invalid-verification-code.error';
import { VerificationCodeCheck, VerificationCodeService } from '../../../../src/application/user/verification-code-service';

function buildUserRepository(overrides: Partial<UserRepository> = {}): UserRepository {
  return {
    findByEmail: vi.fn().mockResolvedValue(null),
    findById: vi.fn().mockResolvedValue(null),
    save: vi.fn().mockResolvedValue(undefined),
    delete: vi.fn().mockResolvedValue(undefined),
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

function buildVerificationCodeService(check: VerificationCodeCheck = 'valid'): VerificationCodeService {
  return { issue: vi.fn().mockResolvedValue('123456'), consume: vi.fn().mockResolvedValue(check) };
}

const existingUser = User.create({
  id: 'user-id',
  email: 'parent@example.com',
  passwordHash: 'hashed-password',
  name: 'Jane Doe',
});

describe('DeleteUserAccountUseCase', () => {
  it('deletes the account when currentPassword is correct', async () => {
    const deleteFn = vi.fn().mockResolvedValue(undefined);
    const userRepository = buildUserRepository({ findById: vi.fn().mockResolvedValue(existingUser), delete: deleteFn });
    const passwordHasher = buildPasswordHasher();
    const useCase = new DeleteUserAccountUseCase(userRepository, passwordHasher, buildVerificationCodeService());

    await useCase.execute({ userId: existingUser.id, currentPassword: 'correct-password' });

    expect(passwordHasher.compare).toHaveBeenCalledWith('correct-password', existingUser.passwordHash);
    expect(deleteFn).toHaveBeenCalledWith(existingUser.id);
  });

  it('rejects when currentPassword is incorrect', async () => {
    const deleteFn = vi.fn().mockResolvedValue(undefined);
    const userRepository = buildUserRepository({ findById: vi.fn().mockResolvedValue(existingUser), delete: deleteFn });
    const passwordHasher = buildPasswordHasher({ compare: vi.fn().mockResolvedValue(false) });
    const useCase = new DeleteUserAccountUseCase(userRepository, passwordHasher, buildVerificationCodeService());

    await expect(useCase.execute({ userId: existingUser.id, currentPassword: 'wrong' })).rejects.toThrow(
      IncorrectPasswordError,
    );
    expect(deleteFn).not.toHaveBeenCalled();
  });

  it('rejects when the user does not exist', async () => {
    const deleteFn = vi.fn().mockResolvedValue(undefined);
    const userRepository = buildUserRepository({ findById: vi.fn().mockResolvedValue(null), delete: deleteFn });
    const passwordHasher = buildPasswordHasher();
    const useCase = new DeleteUserAccountUseCase(userRepository, passwordHasher, buildVerificationCodeService());

    await expect(useCase.execute({ userId: 'missing-id', currentPassword: 'anything' })).rejects.toThrow(
      UserNotFoundError,
    );
    expect(deleteFn).not.toHaveBeenCalled();
  });

  // An account opened by a sign-in code has no password its owner knows, so it confirms deletion
  // with a code mailed for that purpose, checked against the account's own address.
  it('deletes the account with a deletion code, without asking for a password', async () => {
    const deleteFn = vi.fn().mockResolvedValue(undefined);
    const userRepository = buildUserRepository({ findById: vi.fn().mockResolvedValue(existingUser), delete: deleteFn });
    const passwordHasher = buildPasswordHasher();
    const codes = buildVerificationCodeService('valid');
    const useCase = new DeleteUserAccountUseCase(userRepository, passwordHasher, codes);

    await useCase.execute({ userId: existingUser.id, code: '123456' });

    expect(codes.consume).toHaveBeenCalledWith('account-deletion', existingUser.email, '123456');
    expect(passwordHasher.compare).not.toHaveBeenCalled();
    expect(deleteFn).toHaveBeenCalledWith(existingUser.id);
  });

  it('keeps the account when the deletion code is not valid', async () => {
    const deleteFn = vi.fn().mockResolvedValue(undefined);
    const userRepository = buildUserRepository({ findById: vi.fn().mockResolvedValue(existingUser), delete: deleteFn });
    const useCase = new DeleteUserAccountUseCase(userRepository, buildPasswordHasher(), buildVerificationCodeService('invalid'));

    await expect(useCase.execute({ userId: existingUser.id, code: '000000' })).rejects.toThrow(InvalidVerificationCodeError);
    expect(deleteFn).not.toHaveBeenCalled();
  });
});
