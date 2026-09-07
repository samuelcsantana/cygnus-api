import { randomBytes, randomUUID } from 'node:crypto';

import { User } from '../../domain/user/user';
import { logger } from '../../shared/logging/logger';
import { PasswordHasher } from './password-hasher';
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
 *
 * **It also signs people up.** An address with no account that proves it holds the mailbox gets one
 * created here, which is the point of the flow rather than a shortcut in it: until now an
 * unregistered person got the same reassuring "we sent you a code" as everybody else and then
 * waited for an e-mail that was never sent. The uniform answer was honest about nothing.
 *
 * **The account is created here and never at the request step.** A mistyped address must not leave
 * a row behind, and proving control of the mailbox is the only evidence this flow ever has.
 *
 * The new account has no name and no usable password, and both are deliberate:
 *
 * - Asking for a name *before* the code would mean asking only unknown addresses, which hands back
 *   the account-enumeration oracle this whole flow is built to deny. It is asked after sign-in, by
 *   the frontend, where it reveals nothing.
 * - The password hash is random bytes nobody holds the preimage of, so no password authenticates
 *   this account until its owner sets one through "esqueci minha senha" — which works, because that
 *   flow now finds a real account. A nullable column would say the same thing in the schema; this
 *   says it without a migration on a table every request reads.
 */
export class VerifyPasswordlessCodeUseCase {
  constructor(
    private readonly userRepository: UserRepository,
    private readonly verificationCodeService: VerificationCodeService,
    private readonly tokenService: TokenService,
    private readonly passwordHasher: PasswordHasher,
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

    const existing = await this.userRepository.findByEmail(email);
    const user = existing ?? (await this.createAccountFor(email));

    return { userId: user.id, ...this.tokenService.generateTokenPair(user.id, user.sessionVersion) };
  }

  private async createAccountFor(email: string): Promise<User> {
    // 32 random bytes hashed as if they were a password: the argon/bcrypt cost is paid once, and
    // what it protects is a value nobody — including us — ever held in plaintext.
    const passwordHash = await this.passwordHasher.hash(randomBytes(32).toString('hex'));

    // `createUnnamed`, not `create`: the domain keeps "a user has a name" true of every account
    // that came through the sign-up form, and this exception is visible here rather than deleted
    // from the entity for everybody. Empty rather than derived from the address — "joao.silva" is
    // not a name, and the frontend asks for the real one on the way in.
    const user = User.createUnnamed({ id: randomUUID(), email, passwordHash });

    await this.userRepository.save(user);
    logger.info({ userId: user.id }, 'auth.passwordless_account_created');

    return user;
  }
}
