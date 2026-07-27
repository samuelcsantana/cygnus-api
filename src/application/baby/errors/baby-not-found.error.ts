import { DomainError } from '../../../shared/errors/domain-error';

export class BabyNotFoundError extends DomainError {
  constructor() {
    super('Baby not found');
  }
}
