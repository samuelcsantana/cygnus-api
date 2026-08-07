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

    const tokenPair = this.tokenService.generateTokenPair(user.id);

    // Refresh tokens are single-use/rotating: revoke the one that was just spent so a leaked or
    // replayed copy of it is rejected immediately, functioning as reuse detection.
    const remainingTtlSeconds = payload.exp - Math.floor(Date.now() / 1000);
    if (remainingTtlSeconds > 0) {
      await this.tokenRevocationService.revoke(payload.jti, remainingTtlSeconds);
    }

    return tokenPair;
  }
}
