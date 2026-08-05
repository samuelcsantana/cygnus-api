import { DomainError } from '../../../shared/errors/domain-error';

export class InvalidCustomVaccineNameError extends DomainError {
  constructor() {
    super('Custom vaccine name must not be empty');
  }
}
