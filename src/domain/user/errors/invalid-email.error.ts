import { DomainError } from '../../../shared/errors/domain-error';

export class InvalidEmailError extends DomainError {
  constructor(email: string) {
    super(`Invalid email format: ${email}`);
  }
}
