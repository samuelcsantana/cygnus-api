import { logger } from '../../shared/logging/logger';
import { UserRepository } from './user-repository';
import { TokenPair, TokenService } from './token-service';
import { VerificationCodeService } from './verification-code-service';
import { InvalidVerificationCodeError } from './errors/invalid-verification-code.error';

export interface VerifyPasswordlessCodeInput {
  email: string;
  code: string;
}

export interface VerifiedSession extends TokenPair {
  userId: string;
}

/**
 * Signing in with a mailed code instead of a password. Ends in exactly the session /auth/login
 * produces — same token pair, same cookies — so nothing downstream has to know how the user got in.
 */
export class VerifyPasswordlessCodeUseCase {
  constructor(
    private readonly userRepository: UserRepository,
    private readonly verificationCodeService: VerificationCodeService,
    private readonly tokenService: TokenService,
  ) {}

  async execute(input: VerifyPasswordlessCodeInput): Promise<VerifiedSession> {
    const email = input.email.trim().toLowerCase();

    // Checked before the account is looked up: an address with no account never had a code issued,
    // so it fails here as 'not-found' and is indistinguishable from a wrong code. A malformed code
    // simply does not match the stored hash — no separate format branch, and therefore no separate
    // status code for the client to read a hint from.
    const check = await this.verificationCodeService.consume('passwordless', email, input.code);

    if (check !== 'valid') {
      logger.warn({ check, purpose: 'passwordless' }, 'auth.verification_code_rejected');
      throw new InvalidVerificationCodeError();
    }

    const user = await this.userRepository.findByEmail(email);

    if (!user) {
      // Only reachable if the account was deleted between the code being issued and used.
      throw new InvalidVerificationCodeError();
    }

    return { userId: user.id, ...this.tokenService.generateTokenPair(user.id, user.sessionVersion) };
  }
}
