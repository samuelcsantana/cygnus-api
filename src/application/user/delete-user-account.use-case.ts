import { UserRepository } from './user-repository';
import { PasswordHasher } from './password-hasher';
import { IncorrectPasswordError } from './errors/incorrect-password.error';
import { UserNotFoundError } from './errors/user-not-found.error';

export interface DeleteUserAccountInput {
  userId: string;
  currentPassword: string;
}

export class DeleteUserAccountUseCase {
  constructor(
    private readonly userRepository: UserRepository,
    private readonly passwordHasher: PasswordHasher,
  ) {}

  async execute(input: DeleteUserAccountInput): Promise<void> {
    const existingUser = await this.userRepository.findById(input.userId);

    if (!existingUser) {
      throw new UserNotFoundError();
    }

    const isPasswordValid = await this.passwordHasher.compare(input.currentPassword, existingUser.passwordHash);

    if (!isPasswordValid) {
      throw new IncorrectPasswordError();
    }

    await this.userRepository.delete(existingUser.id);
  }
}
