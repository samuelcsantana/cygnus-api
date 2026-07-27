import { DomainError } from '../../../shared/errors/domain-error';

export class InvalidMilestoneTitleError extends DomainError {
  constructor() {
    super('Title must not be empty');
  }
}
