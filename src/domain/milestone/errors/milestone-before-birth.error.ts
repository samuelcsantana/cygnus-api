import { DomainError } from '../../../shared/errors/domain-error';

export class MilestoneBeforeBirthError extends DomainError {
  constructor() {
    super("Achieved date cannot be before the baby's birth date");
  }
}
