import { updateProfileBodySchema } from '../../../../src/presentation/http/schemas/user.schema';
import { describe, expect, it, vi } from 'vitest';
import { UpdateUserProfileUseCase } from '../../../../src/application/user/update-user-profile.use-case';
import { EmailAlreadyInUseError } from '../../../../src/application/user/errors/email-already-in-use.error';
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
    hash: vi.fn().mockResolvedValue('new-hashed-password'),
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

describe('UpdateUserProfileUseCase', () => {
  it('updates only the name without requiring currentPassword', async () => {
    const userRepository = buildUserRepository({ findById: vi.fn().mockResolvedValue(existingUser) });
    const passwordHasher = buildPasswordHasher();
    const useCase = new UpdateUserProfileUseCase(userRepository, passwordHasher);

    const updated = await useCase.execute({ userId: existingUser.id, name: 'Jane Smith' });

    expect(updated.name).toBe('Jane Smith');
    expect(updated.email).toBe(existingUser.email);
    expect(passwordHasher.compare).not.toHaveBeenCalled();
    expect(userRepository.save).toHaveBeenCalledWith(updated);
  });

  it('rejects an email change without currentPassword', async () => {
    const userRepository = buildUserRepository({ findById: vi.fn().mockResolvedValue(existingUser) });
    const passwordHasher = buildPasswordHasher();
    const useCase = new UpdateUserProfileUseCase(userRepository, passwordHasher);

    await expect(useCase.execute({ userId: existingUser.id, email: 'new@example.com' })).rejects.toThrow(
      IncorrectPasswordError,
    );
    expect(userRepository.save).not.toHaveBeenCalled();
  });

  it('rejects an email change when currentPassword is incorrect', async () => {
    const userRepository = buildUserRepository({ findById: vi.fn().mockResolvedValue(existingUser) });
    const passwordHasher = buildPasswordHasher({ compare: vi.fn().mockResolvedValue(false) });
    const useCase = new UpdateUserProfileUseCase(userRepository, passwordHasher);

    await expect(
      useCase.execute({ userId: existingUser.id, email: 'new@example.com', currentPassword: 'wrong' }),
    ).rejects.toThrow(IncorrectPasswordError);
    expect(userRepository.save).not.toHaveBeenCalled();
  });

  it('accepts an email change with a correct currentPassword', async () => {
    const userRepository = buildUserRepository({ findById: vi.fn().mockResolvedValue(existingUser) });
    const passwordHasher = buildPasswordHasher();
    const useCase = new UpdateUserProfileUseCase(userRepository, passwordHasher);

    const updated = await useCase.execute({
      userId: existingUser.id,
      email: 'new@example.com',
      currentPassword: 'correct-password',
    });

    expect(passwordHasher.compare).toHaveBeenCalledWith('correct-password', existingUser.passwordHash);
    expect(updated.email).toBe('new@example.com');
    expect(userRepository.save).toHaveBeenCalledWith(updated);
  });

  it('rejects an email already used by another user', async () => {
    const otherUser = User.create({
      id: 'other-id',
      email: 'taken@example.com',
      passwordHash: 'irrelevant',
      name: 'Other User',
    });
    const userRepository = buildUserRepository({
      findById: vi.fn().mockResolvedValue(existingUser),
      findByEmail: vi.fn().mockResolvedValue(otherUser),
    });
    const passwordHasher = buildPasswordHasher();
    const useCase = new UpdateUserProfileUseCase(userRepository, passwordHasher);

    await expect(
      useCase.execute({ userId: existingUser.id, email: 'taken@example.com', currentPassword: 'correct-password' }),
    ).rejects.toThrow(EmailAlreadyInUseError);
    expect(userRepository.save).not.toHaveBeenCalled();
  });

  it('rejects a password change without currentPassword', async () => {
    const userRepository = buildUserRepository({ findById: vi.fn().mockResolvedValue(existingUser) });
    const passwordHasher = buildPasswordHasher();
    const useCase = new UpdateUserProfileUseCase(userRepository, passwordHasher);

    await expect(useCase.execute({ userId: existingUser.id, password: 'new-Password1' })).rejects.toThrow(
      IncorrectPasswordError,
    );
    expect(passwordHasher.hash).not.toHaveBeenCalled();
    expect(userRepository.save).not.toHaveBeenCalled();
  });

  it('accepts a password change with a correct currentPassword', async () => {
    const userRepository = buildUserRepository({ findById: vi.fn().mockResolvedValue(existingUser) });
    const passwordHasher = buildPasswordHasher();
    const useCase = new UpdateUserProfileUseCase(userRepository, passwordHasher);

    const updated = await useCase.execute({
      userId: existingUser.id,
      password: 'new-Password1',
      currentPassword: 'correct-password',
    });

    expect(passwordHasher.hash).toHaveBeenCalledWith('new-Password1');
    expect(updated.passwordHash).toBe('new-hashed-password');
    expect(userRepository.save).toHaveBeenCalledWith(updated);
  });

  it('rejects when the requesting user no longer exists', async () => {
    const userRepository = buildUserRepository({ findById: vi.fn().mockResolvedValue(null) });
    const passwordHasher = buildPasswordHasher();
    const useCase = new UpdateUserProfileUseCase(userRepository, passwordHasher);

    await expect(useCase.execute({ userId: 'missing-id', name: 'Anyone' })).rejects.toThrow(UserNotFoundError);
    expect(userRepository.save).not.toHaveBeenCalled();
  });
});

it('persists, preserves and removes a profile image', async () => {
  const photo = 'data:image/jpeg;base64,/9j/AA==';
  const repository = buildUserRepository({ findById: vi.fn().mockResolvedValue(existingUser) });
  const useCase = new UpdateUserProfileUseCase(repository, buildPasswordHasher());
  const withPhoto = await useCase.execute({ userId: existingUser.id, avatarUrl: photo });
  expect(withPhoto.avatarUrl).toBe(photo);
  vi.mocked(repository.findById).mockResolvedValue(withPhoto);
  expect((await useCase.execute({ userId: existingUser.id, name: 'New name' })).avatarUrl).toBe(photo);
  expect((await useCase.execute({ userId: existingUser.id, avatarUrl: null })).avatarUrl).toBeNull();
});

it('accepts an image removal and rejects external or executable avatar content', () => {
  expect(updateProfileBodySchema.safeParse({ avatarUrl: null }).success).toBe(true);
  expect(updateProfileBodySchema.safeParse({ avatarUrl: 'data:image/jpeg;base64,/9j/AA==' }).success).toBe(true);
  expect(updateProfileBodySchema.safeParse({ avatarUrl: 'https://example.com/photo.jpg' }).success).toBe(false);
  expect(updateProfileBodySchema.safeParse({ avatarUrl: 'data:image/svg+xml;base64,AAAA' }).success).toBe(false);
});
