import { UserRepository } from './user-repository';
import { TokenPair, TokenService } from './token-service';
import { InvalidTokenError } from './errors/invalid-token.error';

export class RefreshUserSessionUseCase {
  constructor(
    private readonly userRepository: UserRepository,
    private readonly tokenService: TokenService,
  ) {}

  async execute(refreshToken: string): Promise<TokenPair> {
    const payload = this.tokenService.verifyRefreshToken(refreshToken);

    const user = await this.userRepository.findById(payload.sub);

    if (!user) {
      throw new InvalidTokenError();
    }

    return this.tokenService.generateTokenPair(user.id);
  }
}
