import { DomainError } from '../../../shared/errors/domain-error';

export class MedicationNotFoundError extends DomainError {
  constructor() {
    super('Medication not found');
  }
}
