import { DomainError } from '../../../shared/errors/domain-error';

/**
 * Deliberately says nothing about *why* the code failed. Wrong digits, expired, never issued, too
 * many attempts, and "no account with this e-mail" all raise this same error with this same
 * message — otherwise the verify endpoints would answer a question the request endpoints refuse to
 * answer, and become the account-enumeration oracle the flow is designed to avoid.
 */
export class InvalidVerificationCodeError extends DomainError {
  constructor() {
    super('Invalid or expired code');
  }
}
