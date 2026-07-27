import { DomainError } from '../../../shared/errors/domain-error';

export class AppointmentNotFoundError extends DomainError {
  constructor() {
    super('Appointment not found');
  }
}
