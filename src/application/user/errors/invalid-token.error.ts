import { DomainError } from '../../../shared/errors/domain-error';

export class InvalidTokenError extends DomainError {
  constructor() {
    super('Invalid or expired token');
  }
}
