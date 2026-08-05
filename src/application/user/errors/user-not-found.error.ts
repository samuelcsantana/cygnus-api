import { DomainError } from '../../../shared/errors/domain-error';

export class UserNotFoundError extends DomainError {
  constructor() {
    super('User not found');
  }
}
