import { DomainError } from '../../../shared/errors/domain-error';

export class InvalidVaccineNameError extends DomainError {
  constructor() {
    super('Name must not be empty');
  }
}
