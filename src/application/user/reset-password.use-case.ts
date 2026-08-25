import { logger } from '../../shared/logging/logger';
import { User } from '../../domain/user/user';
import { UserRepository } from './user-repository';
import { PasswordHasher } from './password-hasher';
import { TokenService } from './token-service';
import { VerificationCodeService } from './verification-code-service';
import { InvalidVerificationCodeError } from './errors/invalid-verification-code.error';
import { VerifiedSession } from './verify-passwordless-code.use-case';

export interface ResetPasswordInput {
  email: string;
  code: string;
  password: string;
}

/**
 * Setting a new password with a mailed code, for someone who cannot log in to change it the normal
 * way (UpdateUserProfileUseCase, which requires the current password).
 *
 * Resetting also ends every other session. A reset is what someone does *after* suspecting their
 * account was reached by somebody else, so leaving the intruder's refresh token working would make
 * the whole operation cosmetic.
 */
export class ResetPasswordUseCase {
  constructor(
    private readonly userRepository: UserRepository,
    private readonly verificationCodeService: VerificationCodeService,
    private readonly passwordHasher: PasswordHasher,
    private readonly tokenService: TokenService,
  ) {}

  async execute(input: ResetPasswordInput): Promise<VerifiedSession> {
    const email = input.email.trim().toLowerCase();

    const check = await this.verificationCodeService.consume('password-reset', email, input.code);

    if (check !== 'valid') {
      logger.warn({ check, purpose: 'password-reset' }, 'auth.verification_code_rejected');
      throw new InvalidVerificationCodeError();
    }

    const user = await this.userRepository.findByEmail(email);

    if (!user) {
      throw new InvalidVerificationCodeError();
    }

    const passwordHash = await this.passwordHasher.hash(input.password);
    const sessionVersion = user.sessionVersion + 1;

    await this.userRepository.save(
      User.create({
        id: user.id,
        email: user.email,
        passwordHash,
        name: user.name,
        emailNotificationsEnabled: user.emailNotificationsEnabled,
        createdAt: user.createdAt,
        sessionVersion,
      }),
    );

    // Minted at the *new* version, so the session this request hands back is the only one that
    // survives its own invalidation. Every refresh token still out there carries the old number.
    const tokens = this.tokenService.generateTokenPair(user.id, sessionVersion);

    logger.info({ userId: user.id }, 'auth.password_reset_succeeded');

    return { userId: user.id, ...tokens };
  }
}
