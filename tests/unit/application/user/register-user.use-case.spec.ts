import { describe, expect, it, vi } from 'vitest';
import { RegisterUserUseCase } from '../../../../src/application/user/register-user.use-case';
import { EmailAlreadyInUseError } from '../../../../src/application/user/errors/email-already-in-use.error';
import { UserRepository } from '../../../../src/application/user/user-repository';
import { PasswordHasher } from '../../../../src/application/user/password-hasher';
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

describe('RegisterUserUseCase', () => {
  it('creates and persists a new user with a hashed password', async () => {
    const userRepository = buildUserRepository();
    const passwordHasher = buildPasswordHasher();
    const useCase = new RegisterUserUseCase(userRepository, passwordHasher);

    const user = await useCase.execute({
      email: 'parent@example.com',
      password: 'S3cur3-Password',
      name: 'Jane Doe',
    });

    expect(passwordHasher.hash).toHaveBeenCalledWith('S3cur3-Password');
    expect(userRepository.save).toHaveBeenCalledWith(user);
    expect(user).toBeInstanceOf(User);
    expect(user.email).toBe('parent@example.com');
    expect(user.passwordHash).toBe('hashed-password');
  });

  it('rejects registration when the email is already in use', async () => {
    const existingUser = User.create({
      id: 'existing-id',
      email: 'parent@example.com',
      passwordHash: 'irrelevant',
      name: 'Existing User',
    });
    const userRepository = buildUserRepository({
      findByEmail: vi.fn().mockResolvedValue(existingUser),
    });
    const passwordHasher = buildPasswordHasher();
    const useCase = new RegisterUserUseCase(userRepository, passwordHasher);

    await expect(
      useCase.execute({ email: 'parent@example.com', password: 'S3cur3-Password', name: 'Jane Doe' }),
    ).rejects.toThrow(EmailAlreadyInUseError);

    expect(userRepository.save).not.toHaveBeenCalled();
  });
});
