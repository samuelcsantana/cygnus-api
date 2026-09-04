import { DomainError } from '../../../shared/errors/domain-error';

export class SpecialistNotFoundError extends DomainError {
  constructor() {
    super('Specialist not found');
  }
}
