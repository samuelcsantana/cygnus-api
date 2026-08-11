import { DomainError } from '../../../shared/errors/domain-error';

export class GuardianNotFoundError extends DomainError {
  constructor() {
    super('Guardian not found');
  }
}
