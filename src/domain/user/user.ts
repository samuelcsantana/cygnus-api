import { Email } from './email.vo';
import { InvalidNameError } from './errors/invalid-name.error';

export interface UserProps {
  id: string;
  email: string;
  passwordHash: string;
  name: string;
  createdAt: Date;
}

export class User {
  readonly id: string;
  readonly email: string;
  readonly passwordHash: string;
  readonly name: string;
  readonly createdAt: Date;

  private constructor(props: UserProps) {
    this.id = props.id;
    this.email = props.email;
    this.passwordHash = props.passwordHash;
    this.name = props.name;
    this.createdAt = props.createdAt;
  }

  static create(props: { id: string; email: string; passwordHash: string; name: string; createdAt?: Date }): User {
    const name = props.name.trim();

    if (name.length === 0) {
      throw new InvalidNameError();
    }

    const email = Email.create(props.email).toString();

    return new User({
      id: props.id,
      email,
      passwordHash: props.passwordHash,
      name,
      createdAt: props.createdAt ?? new Date(),
    });
  }
}
