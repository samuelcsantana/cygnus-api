import { DomainError } from '../../../shared/errors/domain-error';

export class InvalidSpecialistNameError extends DomainError {
  constructor() {
    super('Specialist name cannot be empty');
  }
}
