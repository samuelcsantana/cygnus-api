import { DomainError } from '../../../shared/errors/domain-error';

export class CannotRemoveOwnerError extends DomainError {
  constructor() {
    super('The baby profile owner cannot be removed as a guardian');
  }
}
