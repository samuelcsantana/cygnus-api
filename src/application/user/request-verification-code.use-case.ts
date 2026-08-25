import { logger } from '../../shared/logging/logger';
import { UserRepository } from './user-repository';
import { VerificationCodePurpose, VerificationCodeService } from './verification-code-service';

export interface RequestVerificationCodeInput {
  email: string;
}

/**
 * The request half of both assisted flows: "send me a code". One use case serves passwordless
 * sign-in and password reset because the logic is identical — only the purpose the code is scoped
 * to and the e-mail template differ, both injected.
 *
 * It resolves successfully in every case, including an address with no account and an address that
 * has asked too often. The caller must not be able to tell those apart from the outside: an
 * endpoint that answers differently for a registered e-mail is a way to test whether someone has
 * an account here, and this is a health app — the mere fact that an address is registered is
 * something worth protecting.
 */
export class RequestVerificationCodeUseCase {
  constructor(
    private readonly userRepository: UserRepository,
    private readonly verificationCodeService: VerificationCodeService,
    private readonly purpose: VerificationCodePurpose,
    private readonly sendCodeEmail: (to: string, code: string) => Promise<void>,
    /**
     * Writes the issued code to the application log. Wired to `NODE_ENV !== 'production'` because
     * EmailService silently no-ops when RESEND_API_KEY is unset — which is the default for local
     * development, CI and the test suite. Without this, the whole flow is unusable off-production
     * and fails in the one way it is designed never to reveal: a 200 with nothing behind it.
     */
    private readonly logIssuedCode: boolean = false,
  ) {}

  async execute(input: RequestVerificationCodeInput): Promise<void> {
    const email = input.email.trim().toLowerCase();
    const user = await this.userRepository.findByEmail(email);

    if (!user) {
      // No account: no code, no mail, no trace of the difference in the response.
      logger.info({ purpose: this.purpose }, 'auth.verification_code_requested_for_unknown_email');
      return;
    }

    const code = await this.verificationCodeService.issue(this.purpose, email);

    if (!code) {
      logger.warn({ purpose: this.purpose, userId: user.id }, 'auth.verification_code_request_throttled');
      return;
    }

    if (this.logIssuedCode) {
      logger.info({ purpose: this.purpose, email, code }, 'auth.verification_code_issued (non-production only)');
    }

    // A delivery failure is logged, not raised. Resend being down is not something the caller can
    // act on, and surfacing it would produce a 500 for a registered address and a 200 for an
    // unregistered one — the enumeration difference this flow exists to avoid.
    try {
      await this.sendCodeEmail(user.email, code);
    } catch (error) {
      logger.error({ err: error, purpose: this.purpose, userId: user.id }, 'auth.verification_code_email_failed');
    }
  }
}
