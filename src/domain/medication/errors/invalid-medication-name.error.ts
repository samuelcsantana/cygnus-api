import { DomainError } from '../../../shared/errors/domain-error';

export class InvalidMedicationNameError extends DomainError {
  constructor() {
    super('Medication name cannot be empty');
  }
}
