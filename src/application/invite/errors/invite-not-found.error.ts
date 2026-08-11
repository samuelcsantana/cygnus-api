import { DomainError } from '../../../shared/errors/domain-error';

export class InviteNotFoundError extends DomainError {
  constructor() {
    super('Invite not found');
  }
}
