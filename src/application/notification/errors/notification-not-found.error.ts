import { DomainError } from '../../../shared/errors/domain-error';

export class NotificationNotFoundError extends DomainError {
  constructor() {
    super('Notification not found');
  }
}
