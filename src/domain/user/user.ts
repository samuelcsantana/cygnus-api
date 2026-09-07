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

  /**
   * Rebuilds an entity that is already in the database.
   *
   * **Not `create`.** That one enforces the rules for making a *new* user, and running them again
   * on a row that already exists says that a record the system itself wrote cannot be read back —
   * which is how an unnamed account (see `createUnnamed`) turned every `GET /auth/me` into a 500
   * until this existed. Reconstitution trusts the database, because by then the database is the
   * record; validation belongs at the door, once.
   */
  static fromPersistence(props: UserProps): User {
    return new User(props);
  }

  /**
   * An account that exists before anybody has said what to call its owner.
   *
   * Passwordless sign-in creates the account from a verified code, and the name cannot be asked
   * for at that moment: the request screen only knows an address, and asking for a name *only*
   * when the address is unknown would answer the question that flow is built to refuse — whether
   * this address has an account here. So it is asked after the session exists, by the frontend,
   * where it reveals nothing.
   *
   * A separate factory rather than a looser `create`: "a user has a name" stays true of every
   * account that came through the sign-up form, and the exception is visible at the one call site
   * that takes it, instead of being an invariant quietly deleted for everybody.
   */
  static createUnnamed(props: { id: string; email: string; passwordHash: string }): User {
    return new User({
      id: props.id,
      email: Email.create(props.email).toString(),
      passwordHash: props.passwordHash,
      name: '',
      emailNotificationsEnabled: true,
      createdAt: new Date(),
      sessionVersion: 0,
    });
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
