import { Email } from './email.vo';
import { InvalidNameError } from './errors/invalid-name.error';

export interface UserProps {
  id: string;
  email: string;
  passwordHash: string;
  name: string;
  emailNotificationsEnabled: boolean;
  createdAt: Date;
  sessionVersion: number;
}

export class User {
  readonly id: string;
  readonly email: string;
  readonly passwordHash: string;
  readonly name: string;
  readonly emailNotificationsEnabled: boolean;
  readonly createdAt: Date;
  /**
   * Incremented to end every session this account has open — refresh tokens carry the version they
   * were minted under, so bumping it invalidates all of them at once without enumerating any.
   */
  readonly sessionVersion: number;

  private constructor(props: UserProps) {
    this.id = props.id;
    this.email = props.email;
    this.passwordHash = props.passwordHash;
    this.name = props.name;
    this.emailNotificationsEnabled = props.emailNotificationsEnabled;
    this.createdAt = props.createdAt;
    this.sessionVersion = props.sessionVersion;
  }

  static create(props: {
    id: string;
    email: string;
    passwordHash: string;
    name: string;
    emailNotificationsEnabled?: boolean;
    createdAt?: Date;
    sessionVersion?: number;
  }): User {
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
      emailNotificationsEnabled: props.emailNotificationsEnabled ?? true,
      createdAt: props.createdAt ?? new Date(),
      sessionVersion: props.sessionVersion ?? 0,
    });
  }
}
