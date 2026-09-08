import { randomBytes } from 'node:crypto';
import { GoogleIdentity, GoogleIdentityRepository } from './google-identity';
import { PasswordHasher } from './password-hasher';
import { TokenService } from './token-service';
import { VerifiedSession } from './verify-passwordless-code.use-case';

export class SignInWithGoogleUseCase {
  constructor(
    private readonly identities: GoogleIdentityRepository,
    private readonly passwords: PasswordHasher,
    private readonly tokens: TokenService,
  ) {}

  async execute(identity: GoogleIdentity): Promise<VerifiedSession> {
    const existing = await this.identities.findBySubject(identity.subject);
    const user = existing ?? await this.identities.connect(
      identity, await this.passwords.hash(randomBytes(32).toString('hex')),
    );
    return { userId: user.id, ...this.tokens.generateTokenPair(user.id, user.sessionVersion) };
  }
}
