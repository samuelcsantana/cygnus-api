import { DomainError } from '../../../shared/errors/domain-error';

export class FutureBirthDateError extends DomainError {
  constructor() {
    super('Birth date cannot be in the future');
  }
}
