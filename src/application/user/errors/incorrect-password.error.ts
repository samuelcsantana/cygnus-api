import { DomainError } from '../../../shared/errors/domain-error';

export class IncorrectPasswordError extends DomainError {
  constructor() {
    super('Incorrect current password');
  }
}
