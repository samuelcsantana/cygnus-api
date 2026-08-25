/**
 * The two flows that prove control of an e-mail address with a short-lived numeric code:
 * signing in without a password, and resetting a forgotten one. Codes are scoped by purpose so a
 * code mailed for one flow can never be spent on the other — a reset code is a password change,
 * a passwordless code is only a login.
 */
export type VerificationCodePurpose = 'passwordless' | 'password-reset';

/**
 * Why a code was rejected. The caller maps every failing value to the same client-facing error
 * (see InvalidVerificationCodeError) — the distinction exists for server logs, where knowing that
 * an account is being hammered with wrong codes is worth having.
 */
export type VerificationCodeCheck = 'valid' | 'invalid' | 'not-found' | 'too-many-attempts';

export interface VerificationCodeService {
  /**
   * Generates, stores and returns a new code for (purpose, email), replacing any code already
   * outstanding for that pair.
   *
   * Returns `null` when the address has requested too many codes too quickly. That is a throttle
   * on *sending mail to someone else's inbox*, so it is deliberately not an error: the caller
   * still answers the client exactly as it would have on success.
   */
  issue(purpose: VerificationCodePurpose, email: string): Promise<string | null>;

  /**
   * Checks `code` against the outstanding code for (purpose, email) and consumes it on success —
   * a code is single-use. Wrong guesses are counted, and once the attempt budget is spent the
   * stored code is destroyed rather than left available for one more try.
   */
  consume(purpose: VerificationCodePurpose, email: string, code: string): Promise<VerificationCodeCheck>;
}
