import { DomainError } from '../../../shared/errors/domain-error';

export class VaccineNotFoundError extends DomainError {
  constructor() {
    super('Vaccine not found');
  }
}
