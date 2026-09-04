import { DomainError } from '../../../shared/errors/domain-error';

export class MedicationEndsBeforeItStartsError extends DomainError {
  constructor() {
    super('A medication cannot end before it started');
  }
}
