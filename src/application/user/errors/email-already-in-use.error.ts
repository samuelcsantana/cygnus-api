import { DomainError } from '../../../shared/errors/domain-error';

export class EmailAlreadyInUseError extends DomainError {
  constructor(email: string) {
    super(`Email already in use: ${email}`);
  }
}
