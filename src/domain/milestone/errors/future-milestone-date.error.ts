import { DomainError } from '../../../shared/errors/domain-error';

export class FutureMilestoneDateError extends DomainError {
  constructor() {
    super('Achieved date cannot be in the future');
  }
}
