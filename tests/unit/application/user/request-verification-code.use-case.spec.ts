import { describe, expect, it, vi } from 'vitest';
import { RequestVerificationCodeUseCase } from '../../../../src/application/user/request-verification-code.use-case';
import { UserRepository } from '../../../../src/application/user/user-repository';
import { VerificationCodeService } from '../../../../src/application/user/verification-code-service';
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

function buildVerificationCodeService(overrides: Partial<VerificationCodeService> = {}): VerificationCodeService {
  return {
    issue: vi.fn().mockResolvedValue('123456'),
    consume: vi.fn().mockResolvedValue('valid'),
    ...overrides,
  };
}

const existingUser = User.create({
  id: 'user-id',
  email: 'parent@example.com',
  passwordHash: 'hashed-password',
  name: 'Jane Doe',
});

describe('RequestVerificationCodeUseCase', () => {
  it('issues a code scoped to its purpose and mails it to the registered address', async () => {
    const userRepository = buildUserRepository({ findByEmail: vi.fn().mockResolvedValue(existingUser) });
    const verificationCodeService = buildVerificationCodeService();
    const sendCodeEmail = vi.fn().mockResolvedValue(undefined);
    const useCase = new RequestVerificationCodeUseCase(
      userRepository,
      verificationCodeService,
      'password-reset',
      sendCodeEmail,
    );

    await useCase.execute({ email: 'parent@example.com' });

    expect(verificationCodeService.issue).toHaveBeenCalledWith('password-reset', 'parent@example.com');
    expect(sendCodeEmail).toHaveBeenCalledWith('parent@example.com', '123456');
  });

  it('normalizes the address before looking it up, so casing and stray spaces still find the account', async () => {
    const userRepository = buildUserRepository({ findByEmail: vi.fn().mockResolvedValue(existingUser) });
    const verificationCodeService = buildVerificationCodeService();
    const useCase = new RequestVerificationCodeUseCase(
      userRepository,
      verificationCodeService,
      'passwordless',
      vi.fn().mockResolvedValue(undefined),
    );

    await useCase.execute({ email: '  Parent@Example.com ' });

    expect(userRepository.findByEmail).toHaveBeenCalledWith('parent@example.com');
    expect(verificationCodeService.issue).toHaveBeenCalledWith('passwordless', 'parent@example.com');
  });

  it('resolves without issuing or mailing anything for an address with no account', async () => {
    const userRepository = buildUserRepository({ findByEmail: vi.fn().mockResolvedValue(null) });
    const verificationCodeService = buildVerificationCodeService();
    const sendCodeEmail = vi.fn().mockResolvedValue(undefined);
    const useCase = new RequestVerificationCodeUseCase(
      userRepository,
      verificationCodeService,
      'passwordless',
      sendCodeEmail,
    );

    await expect(useCase.execute({ email: 'stranger@example.com' })).resolves.toBeUndefined();

    expect(verificationCodeService.issue).not.toHaveBeenCalled();
    expect(sendCodeEmail).not.toHaveBeenCalled();
  });

  it('resolves silently when the address has asked for too many codes', async () => {
    const userRepository = buildUserRepository({ findByEmail: vi.fn().mockResolvedValue(existingUser) });
    const verificationCodeService = buildVerificationCodeService({ issue: vi.fn().mockResolvedValue(null) });
    const sendCodeEmail = vi.fn().mockResolvedValue(undefined);
    const useCase = new RequestVerificationCodeUseCase(
      userRepository,
      verificationCodeService,
      'passwordless',
      sendCodeEmail,
    );

    await expect(useCase.execute({ email: 'parent@example.com' })).resolves.toBeUndefined();
    expect(sendCodeEmail).not.toHaveBeenCalled();
  });

  it('swallows a delivery failure, so a mail outage cannot reveal that the address is registered', async () => {
    const userRepository = buildUserRepository({ findByEmail: vi.fn().mockResolvedValue(existingUser) });
    const verificationCodeService = buildVerificationCodeService();
    const sendCodeEmail = vi.fn().mockRejectedValue(new Error('Resend is down'));
    const useCase = new RequestVerificationCodeUseCase(
      userRepository,
      verificationCodeService,
      'passwordless',
      sendCodeEmail,
    );

    await expect(useCase.execute({ email: 'parent@example.com' })).resolves.toBeUndefined();
  });
});
