import { UserRepository } from './user-repository';
import { PasswordHasher } from './password-hasher';
import { TokenPair, TokenService } from './token-service';
import { InvalidCredentialsError } from './errors/invalid-credentials.error';

export interface AuthenticateUserInput {
  email: string;
  password: string;
}

export class AuthenticateUserUseCase {
  constructor(
    private readonly userRepository: UserRepository,
    private readonly passwordHasher: PasswordHasher,
    private readonly tokenService: TokenService,
  ) {}

  async execute(input: AuthenticateUserInput): Promise<TokenPair> {
    const user = await this.userRepository.findByEmail(input.email);

    if (!user) {
      throw new InvalidCredentialsError();
    }

    const isPasswordValid = await this.passwordHasher.compare(input.password, user.passwordHash);

    if (!isPasswordValid) {
      throw new InvalidCredentialsError();
    }

    return this.tokenService.generateTokenPair(user.id, user.sessionVersion);
  }
}
