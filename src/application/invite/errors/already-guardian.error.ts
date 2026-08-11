import { DomainError } from '../../../shared/errors/domain-error';

export class AlreadyGuardianError extends DomainError {
  constructor() {
    super('User is already a guardian of this baby');
  }
}
