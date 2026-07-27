import { DomainError } from '../../../shared/errors/domain-error';

export class MilestoneNotFoundError extends DomainError {
  constructor() {
    super('Milestone not found');
  }
}
