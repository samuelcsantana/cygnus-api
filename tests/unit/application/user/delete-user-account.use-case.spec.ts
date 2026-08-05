import { describe, expect, it, vi } from 'vitest';
import { DeleteUserAccountUseCase } from '../../../../src/application/user/delete-user-account.use-case';
import { IncorrectPasswordError } from '../../../../src/application/user/errors/incorrect-password.error';
import { UserNotFoundError } from '../../../../src/application/user/errors/user-not-found.error';
import { UserRepository } from '../../../../src/application/user/user-repository';
import { PasswordHasher } from '../../../../src/application/user/password-hasher';
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

function buildPasswordHasher(overrides: Partial<PasswordHasher> = {}): PasswordHasher {
  return {
    hash: vi.fn().mockResolvedValue('hashed-password'),
    compare: vi.fn().mockResolvedValue(true),
    ...overrides,
  };
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
    const useCase = new DeleteUserAccountUseCase(userRepository, passwordHasher);

    await useCase.execute({ userId: existingUser.id, currentPassword: 'correct-password' });

    expect(passwordHasher.compare).toHaveBeenCalledWith('correct-password', existingUser.passwordHash);
    expect(deleteFn).toHaveBeenCalledWith(existingUser.id);
  });

  it('rejects when currentPassword is incorrect', async () => {
    const deleteFn = vi.fn().mockResolvedValue(undefined);
    const userRepository = buildUserRepository({ findById: vi.fn().mockResolvedValue(existingUser), delete: deleteFn });
    const passwordHasher = buildPasswordHasher({ compare: vi.fn().mockResolvedValue(false) });
    const useCase = new DeleteUserAccountUseCase(userRepository, passwordHasher);

    await expect(useCase.execute({ userId: existingUser.id, currentPassword: 'wrong' })).rejects.toThrow(
      IncorrectPasswordError,
    );
    expect(deleteFn).not.toHaveBeenCalled();
  });

  it('rejects when the user does not exist', async () => {
    const deleteFn = vi.fn().mockResolvedValue(undefined);
    const userRepository = buildUserRepository({ findById: vi.fn().mockResolvedValue(null), delete: deleteFn });
    const passwordHasher = buildPasswordHasher();
    const useCase = new DeleteUserAccountUseCase(userRepository, passwordHasher);

    await expect(useCase.execute({ userId: 'missing-id', currentPassword: 'anything' })).rejects.toThrow(
      UserNotFoundError,
    );
    expect(deleteFn).not.toHaveBeenCalled();
  });
});
