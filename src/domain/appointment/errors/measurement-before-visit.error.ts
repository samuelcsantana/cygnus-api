import { DomainError } from '../../../shared/errors/domain-error';

export class MeasurementBeforeVisitError extends DomainError {
  constructor() {
    super('Weight and height belong to a visit that has taken place, not to an upcoming one');
  }
}
