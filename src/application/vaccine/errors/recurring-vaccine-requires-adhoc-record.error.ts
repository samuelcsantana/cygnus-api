import { DomainError } from '../../../shared/errors/domain-error';

export class RecurringVaccineRequiresAdhocRecordError extends DomainError {
  constructor() {
    super('Recurring vaccines must be registered as campaign records');
  }
}
