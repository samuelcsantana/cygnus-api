import { DomainError } from '../../../shared/errors/domain-error';

export class InvalidNameError extends DomainError {
  constructor() {
    super('Name must not be empty');
  }
}
