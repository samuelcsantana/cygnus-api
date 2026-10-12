import { Email } from './email.vo';
import { InvalidNameError } from './errors/invalid-name.error';

/** How long a demo account lives before the hourly sweep deletes it, with everything it holds. */
export const DEMO_ACCOUNT_LIFETIME_MS = 24 * 60 * 60 * 1000;

/**
 * The domain every demo account's address is built on. `.invalid` is reserved by RFC 2606 and can
 * never resolve, so nothing addressed there can be delivered — not by us, and not by anyone who
 * copies the address off a demo profile into another form.
 */
export const DEMO_EMAIL_DOMAIN = 'demo.cygnus.invalid';

export interface UserProps {
  id: string;
  email: string;
  passwordHash: string;
  avatarUrl?: string | null;
  name: string;
  emailNotificationsEnabled: boolean;
  createdAt: Date;
  sessionVersion: number;
  demoExpiresAt?: Date | null;
}

export class User {
  readonly id: string;
  readonly email: string;
  readonly passwordHash: string;
  readonly avatarUrl: string | null;
  readonly name: string;
  readonly emailNotificationsEnabled: boolean;
  readonly createdAt: Date;
  /**
   * Incremented to end every session this account has open — refresh tokens carry the version they
   * were minted under, so bumping it invalidates all of them at once without enumerating any.
   */
  readonly sessionVersion: number;
  /** When the sweep deletes this account; null for every account a person actually owns. */
  readonly demoExpiresAt: Date | null;

  private constructor(props: UserProps) {
    this.id = props.id;
    this.email = props.email;
    this.passwordHash = props.passwordHash;
    this.avatarUrl = props.avatarUrl ?? null;
    this.name = props.name;
    this.emailNotificationsEnabled = props.emailNotificationsEnabled;
    this.createdAt = props.createdAt;
    this.sessionVersion = props.sessionVersion;
    this.demoExpiresAt = props.demoExpiresAt ?? null;
  }

  get isDemo(): boolean {
    return this.demoExpiresAt !== null;
  }

  /** True once a demo account has outlived its 24 hours, even if the sweep has not reached it yet. */
  isExpiredDemoAt(now: Date): boolean {
    return this.demoExpiresAt !== null && this.demoExpiresAt.getTime() <= now.getTime();
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

  /**
   * The disposable account behind "try the demo": a recruiter or a curious parent sees the app full
   * of data without handing over an address, and the account deletes itself a day later.
   *
   * Everything that would tie it to a person is absent on purpose. The address is synthetic and
   * undeliverable (`DEMO_EMAIL_DOMAIN`), reminder e-mails are off, and the password hash is derived
   * by the caller from random bytes, so no password, code or link can sign into it again — or turn
   * it into a permanent account, because changing the address or the password asks for the current
   * password. The session handed out at creation is the only way in.
   *
   * It does get a name, unlike `createUnnamed`: the frontend asks an unnamed account what to call
   * its owner, and a demo should open on the product, not on a form.
   */
  static createDemo(props: { id: string; passwordHash: string; name: string; now: Date }): User {
    return new User({
      id: props.id,
      email: Email.create(`demo-${props.id}@${DEMO_EMAIL_DOMAIN}`).toString(),
      passwordHash: props.passwordHash,
      name: props.name,
      emailNotificationsEnabled: false,
      createdAt: props.now,
      sessionVersion: 0,
      demoExpiresAt: new Date(props.now.getTime() + DEMO_ACCOUNT_LIFETIME_MS),
    });
  }

  static create(props: {
    id: string;
    email: string;
    passwordHash: string;
    avatarUrl?: string | null;
    name: string;
    emailNotificationsEnabled?: boolean;
    createdAt?: Date;
    sessionVersion?: number;
    demoExpiresAt?: Date | null;
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
      avatarUrl: props.avatarUrl ?? null,
      emailNotificationsEnabled: props.emailNotificationsEnabled ?? true,
      createdAt: props.createdAt ?? new Date(),
      sessionVersion: props.sessionVersion ?? 0,
      demoExpiresAt: props.demoExpiresAt ?? null,
    });
  }
}
