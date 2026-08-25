import { UserRepository } from './user-repository';
import { TokenPair, TokenService } from './token-service';
import { TokenRevocationService } from './token-revocation-service';
import { InvalidTokenError } from './errors/invalid-token.error';

export class RefreshUserSessionUseCase {
  constructor(
    private readonly userRepository: UserRepository,
    private readonly tokenService: TokenService,
    private readonly tokenRevocationService: TokenRevocationService,
  ) {}

  async execute(refreshToken: string): Promise<TokenPair> {
    const payload = this.tokenService.verifyRefreshToken(refreshToken);

    if (await this.tokenRevocationService.isRevoked(payload.jti)) {
      throw new InvalidTokenError();
    }

    const user = await this.userRepository.findById(payload.sub);

    if (!user) {
      throw new InvalidTokenError();
    }

    // Bulk invalidation: a password reset increments the account's session version, so every
    // refresh token minted before it stops matching here — no list of jtis to keep, and no clock to
    // agree on. A token from before this claim existed carries no version and reads as 0, the value
    // every account starts at.
    if ((payload.sessionVersion ?? 0) !== user.sessionVersion) {
      throw new InvalidTokenError();
    }

    const tokenPair = this.tokenService.generateTokenPair(user.id, user.sessionVersion);

    // Refresh tokens are single-use/rotating: revoke the one that was just spent so a leaked or
    // replayed copy of it is rejected immediately, functioning as reuse detection.
    const remainingTtlSeconds = payload.exp - Math.floor(Date.now() / 1000);
    if (remainingTtlSeconds > 0) {
      await this.tokenRevocationService.revoke(payload.jti, remainingTtlSeconds);
    }

    return tokenPair;
  }
}
