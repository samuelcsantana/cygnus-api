import { DemoAccountRepository } from './demo-account-repository';

/**
 * The other half of the demo's promise: the account and everything a visitor typed into it are gone
 * a day later. Idempotent — a second run over the same moment finds nothing — which is what lets the
 * scheduler run it every hour and retry it freely.
 */
export class DeleteExpiredDemoAccountsUseCase {
  constructor(private readonly demoAccountRepository: DemoAccountRepository) {}

  execute(now: Date = new Date()): Promise<number> {
    return this.demoAccountRepository.deleteExpired(now);
  }
}
