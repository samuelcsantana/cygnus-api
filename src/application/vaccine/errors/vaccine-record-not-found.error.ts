import { DomainError } from '../../../shared/errors/domain-error';

export class VaccineRecordNotFoundError extends DomainError {
  constructor() {
    super('Vaccine record not found');
  }
}
