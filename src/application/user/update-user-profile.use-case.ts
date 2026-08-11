import { User } from '../../domain/user/user';
import { UserRepository } from './user-repository';
import { PasswordHasher } from './password-hasher';
import { EmailAlreadyInUseError } from './errors/email-already-in-use.error';
import { IncorrectPasswordError } from './errors/incorrect-password.error';
import { UserNotFoundError } from './errors/user-not-found.error';

export interface UpdateUserProfileInput {
  userId: string;
  name?: string;
  email?: string;
  password?: string;
  currentPassword?: string;
  emailNotificationsEnabled?: boolean;
}

export class UpdateUserProfileUseCase {
  constructor(
    private readonly userRepository: UserRepository,
    private readonly passwordHasher: PasswordHasher,
  ) {}

  async execute(input: UpdateUserProfileInput): Promise<User> {
    const existingUser = await this.userRepository.findById(input.userId);

    if (!existingUser) {
      throw new UserNotFoundError();
    }

    const changesSensitiveField = input.email !== undefined || input.password !== undefined;

    if (changesSensitiveField) {
      const isCurrentPasswordValid =
        !!input.currentPassword && (await this.passwordHasher.compare(input.currentPassword, existingUser.passwordHash));

      if (!isCurrentPasswordValid) {
        throw new IncorrectPasswordError();
      }
    }

    if (input.email !== undefined && input.email !== existingUser.email) {
      const otherUser = await this.userRepository.findByEmail(input.email);

      if (otherUser && otherUser.id !== existingUser.id) {
        throw new EmailAlreadyInUseError(input.email);
      }
    }

    const passwordHash =
      input.password !== undefined ? await this.passwordHasher.hash(input.password) : existingUser.passwordHash;

    const updatedUser = User.create({
      id: existingUser.id,
      email: input.email ?? existingUser.email,
      passwordHash,
      name: input.name ?? existingUser.name,
      emailNotificationsEnabled: input.emailNotificationsEnabled ?? existingUser.emailNotificationsEnabled,
      createdAt: existingUser.createdAt,
    });

    await this.userRepository.save(updatedUser);

    return updatedUser;
  }
}
