import { setTimeout as sleep } from 'node:timers/promises';

import { logger } from '../../shared/logging/logger';
import { UserRepository } from './user-repository';
import { VerificationCodePurpose, VerificationCodeService } from './verification-code-service';

/**
 * Every call to this use case takes at least this long, whatever it did.
 *
 * The identical response body is defeated by the clock without it. An address with an account
 * writes a code to Redis and an address without one does not, and that difference is measurable
 * from outside: 161ms against 4ms while the mail was still awaited here, 1.44ms against 0.56ms
 * once it was not. Both are oracles; only the size changed.
 *
 * A fixed floor rather than random padding, because random padding averages out over enough
 * samples and a floor does not — as long as the work stays under it, which is what the warning
 * below watches for. 120ms leaves roughly eighty times the headroom the slowest path now needs,
 * and is not something a person waiting for an e-mail can perceive.
 */
const RESPONSE_FLOOR_MS = 120;

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
    const startedAt = performance.now();

    try {
      await this.issueAndSend(input);
    } finally {
      const elapsed = performance.now() - startedAt;

      if (elapsed >= RESPONSE_FLOOR_MS) {
        // The floor hides the difference only while the work fits under it. Past that it hides
        // nothing, and the useful thing is to say so rather than quietly go back to leaking.
        logger.warn(
          { purpose: this.purpose, elapsedMs: Math.round(elapsed), floorMs: RESPONSE_FLOOR_MS },
          'auth.verification_code_request_exceeded_time_floor',
        );
      } else {
        await sleep(RESPONSE_FLOOR_MS - elapsed);
      }
    }
  }

  private async issueAndSend(input: RequestVerificationCodeInput): Promise<void> {
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

    // Deliberately not awaited. This is a network call to a third party, and awaiting it put the
    // whole round trip into the response of a registered address and nothing into the response of
    // an unregistered one — measured at ~156ms of the ~157ms gap, which is the entire enumeration
    // difference this flow exists to avoid, handed back by the clock.
    //
    // A delivery failure is still logged rather than raised, for the reason it always was: Resend
    // being down is not something the caller can act on, and a 500 for a real address beside a 200
    // for an unknown one is that same oracle wearing a different number. The .catch is what keeps
    // an unawaited rejection from becoming an unhandled one.
    void this.sendCodeEmail(user.email, code).catch((error: unknown) => {
      logger.error({ err: error, purpose: this.purpose, userId: user.id }, 'auth.verification_code_email_failed');
    });
  }
}
