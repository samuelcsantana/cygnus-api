import { DomainError } from '../../../shared/errors/domain-error';

export class PastAppointmentDateError extends DomainError {
  constructor() {
    super('Appointment date cannot be in the past');
  }
}
