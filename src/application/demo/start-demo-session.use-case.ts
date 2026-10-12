import { randomBytes } from 'node:crypto';
import { PasswordHasher } from '../user/password-hasher';
import { TokenPair, TokenService } from '../user/token-service';
import { VaccineRepository } from '../vaccine/vaccine-repository';
import { DemoAccountRepository } from './demo-account-repository';
import { buildDemoDataset } from './demo-dataset';

export interface DemoSession extends TokenPair {
  userId: string;
  expiresAt: Date;
}

/**
 * One click, one disposable account full of data, and a session for it — so a visitor sees the
 * product instead of a sign-up form.
 *
 * A fresh account per visitor rather than one shared demo login: the app's interesting actions
 * write (marking a dose applied, logging a milestone), and on a shared account every visitor would
 * see what the previous one did, or nothing at all if writes were blocked.
 *
 * The password hash protects random bytes nobody keeps, exactly as for a passwordless sign-up, so
 * the session issued here is the only way into the account for the 24 hours it exists.
 */
export class StartDemoSessionUseCase {
  constructor(
    private readonly vaccineRepository: VaccineRepository,
    private readonly demoAccountRepository: DemoAccountRepository,
    private readonly passwordHasher: PasswordHasher,
    private readonly tokenService: TokenService,
  ) {}

  async execute(now: Date = new Date()): Promise<DemoSession> {
    const [vaccines, passwordHash] = await Promise.all([
      this.vaccineRepository.findAll(),
      this.passwordHasher.hash(randomBytes(32).toString('hex')),
    ]);

    const dataset = buildDemoDataset({ now, passwordHash, vaccines });
    await this.demoAccountRepository.create(dataset);

    const { user } = dataset;

    return {
      userId: user.id,
      // Non-null by construction: `createDemo` always sets it.
      expiresAt: user.demoExpiresAt!,
      ...this.tokenService.generateTokenPair(user.id, user.sessionVersion),
    };
  }
}
