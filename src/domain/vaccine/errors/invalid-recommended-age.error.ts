import { DomainError } from '../../../shared/errors/domain-error';

export class InvalidRecommendedAgeError extends DomainError {
  constructor() {
    super('Recommended age in months must not be negative');
  }
}
