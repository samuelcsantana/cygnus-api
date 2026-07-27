import { randomUUID } from 'node:crypto';
import { User } from '../../domain/user/user';
import { UserRepository } from './user-repository';
import { PasswordHasher } from './password-hasher';
import { EmailAlreadyInUseError } from './errors/email-already-in-use.error';

export interface RegisterUserInput {
  email: string;
  password: string;
  name: string;
}

export class RegisterUserUseCase {
  constructor(
    private readonly userRepository: UserRepository,
    private readonly passwordHasher: PasswordHasher,
  ) {}

  async execute(input: RegisterUserInput): Promise<User> {
    const existingUser = await this.userRepository.findByEmail(input.email);

    if (existingUser) {
      throw new EmailAlreadyInUseError(input.email);
    }

    const passwordHash = await this.passwordHasher.hash(input.password);

    const user = User.create({
      id: randomUUID(),
      email: input.email,
      name: input.name,
      passwordHash,
    });

    await this.userRepository.save(user);

    return user;
  }
}
