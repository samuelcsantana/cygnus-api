import { DomainError } from '../../../shared/errors/domain-error';

export class SpecialistShareForbiddenError extends DomainError {
  constructor() {
    super('A specialist can only be shared with someone who already shares a child with you');
  }
}
