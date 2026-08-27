import { DomainError } from '../../../shared/errors/domain-error';

export class FutureVisitRecordError extends DomainError {
  constructor() {
    super('A visit recorded as already completed cannot be in the future');
  }
}
