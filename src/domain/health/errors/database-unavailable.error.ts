import { DomainError } from '../../../shared/errors/domain-error';

export class DatabaseUnavailableError extends DomainError {
  constructor() {
    super('Database is not reachable');
  }
}
