import { UserRepository } from './user-repository';
import { PasswordHasher } from './password-hasher';
import { VerificationCodeService } from './verification-code-service';
import { IncorrectPasswordError } from './errors/incorrect-password.error';
import { InvalidVerificationCodeError } from './errors/invalid-verification-code.error';
import { UserNotFoundError } from './errors/user-not-found.error';

/**
 * Exactly one proof, never zero and never both. The route's schema refuses the other shapes, so by
 * the time it gets here the choice has been made.
 */
export type DeleteUserAccountInput =
  | { userId: string; currentPassword: string; code?: undefined }
  | { userId: string; code: string; currentPassword?: undefined };

/**
 * Deleting the account, confirmed one of two ways.
 *
 * **A mailed code is accepted beside the password**, and the reason is not convenience: an account
 * created by signing in without a password (`VerifyPasswordlessCodeUseCase`) holds a random hash
 * nobody has the preimage of, so *no* password is ever correct for it — measured as
 * `400 "Incorrect current password"` on an account that had every right to be deleted. Right of
 * erasure is not something to leave behind a door with no key.
 *
 * It also does not weaken anything. Whoever holds the mailbox can already take the account over
 * completely through passwordless sign-in; requiring the password *as well* would protect nothing
 * that is not already reachable, and would keep the door shut on the accounts that need it most.
 *
 * The code is scoped to `account-deletion` and to the account's own address, read from the record
 * rather than from the request: a code mailed to sign somebody in must not be spendable here, and
 * the caller must not get to say whose deletion they are confirming.
 */
export class DeleteUserAccountUseCase {
  constructor(
    private readonly userRepository: UserRepository,
    private readonly passwordHasher: PasswordHasher,
    private readonly verificationCodeService: VerificationCodeService,
  ) {}

  async execute(input: DeleteUserAccountInput): Promise<void> {
    const existingUser = await this.userRepository.findById(input.userId);

    if (!existingUser) {
      throw new UserNotFoundError();
    }

    if (input.code !== undefined) {
      const check = await this.verificationCodeService.consume('account-deletion', existingUser.email, input.code);

      if (check !== 'valid') {
        throw new InvalidVerificationCodeError();
      }
    } else {
      const isPasswordValid = await this.passwordHasher.compare(input.currentPassword, existingUser.passwordHash);

      if (!isPasswordValid) {
        throw new IncorrectPasswordError();
      }
    }

    await this.userRepository.delete(existingUser.id);
  }
}
