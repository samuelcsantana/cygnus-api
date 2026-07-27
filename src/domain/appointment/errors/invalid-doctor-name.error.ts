import { DomainError } from '../../../shared/errors/domain-error';

export class InvalidDoctorNameError extends DomainError {
  constructor() {
    super('Doctor name must not be empty');
  }
}
