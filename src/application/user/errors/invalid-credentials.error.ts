import { DomainError } from '../../../shared/errors/domain-error';

export class InvalidCredentialsError extends DomainError {
  constructor() {
    super('Invalid email or password');
  }
}
