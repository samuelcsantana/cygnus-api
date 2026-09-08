import { User } from '../../domain/user/user';

export interface GoogleIdentity {
  subject: string;
  email: string;
  name: string;
  authoritativeEmail: boolean;
}

export class GoogleSignInError extends Error {
  constructor(public readonly reason: 'failed' | 'email_verification_required' = 'failed') {
    super('Google sign-in could not be completed');
  }
}

export interface GoogleIdentityRepository {
  findBySubject(subject: string): Promise<User | null>;
  connect(identity: GoogleIdentity, passwordHash: string): Promise<User>;
}
