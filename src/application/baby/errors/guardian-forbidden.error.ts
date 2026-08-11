import { DomainError } from '../../../shared/errors/domain-error';

export class GuardianForbiddenError extends DomainError {
  constructor(message = 'Not allowed to perform this action') {
    super(message);
  }
}
