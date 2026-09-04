import { DomainError } from '../../../shared/errors/domain-error';

export class SpecialistBabyForbiddenError extends DomainError {
  constructor() {
    super('A specialist can only be linked to a child you have access to');
  }
}
