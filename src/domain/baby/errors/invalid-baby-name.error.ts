import { DomainError } from '../../../shared/errors/domain-error';

export class InvalidBabyNameError extends DomainError {
  constructor() {
    super('Name must not be empty');
  }
}
