import { DomainError } from '../../../shared/errors/domain-error';

export class InviteNoLongerValidError extends DomainError {
  constructor(reason: 'expired' | 'already-used') {
    super(reason === 'expired' ? 'Invite has expired' : 'Invite has already been used');
  }
}
