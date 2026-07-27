import { DomainError } from '../../../shared/errors/domain-error';

export class InvalidDoseNumberError extends DomainError {
  constructor() {
    super('Dose number must be at least 1');
  }
}
