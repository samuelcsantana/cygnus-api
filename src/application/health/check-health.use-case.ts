import { HealthChecker } from '../../domain/health/health-checker';
import { DatabaseUnavailableError } from '../../domain/health/errors/database-unavailable.error';
import { HealthReport } from '../../domain/health/health-report';

export class CheckHealthUseCase {
  constructor(private readonly healthChecker: HealthChecker) {}

  async execute(): Promise<HealthReport> {
    const isDatabaseUp = await this.healthChecker.checkDatabase();

    if (!isDatabaseUp) {
      throw new DatabaseUnavailableError();
    }

    return {
      status: 'ok',
      uptimeSeconds: Math.floor(process.uptime()),
      timestamp: new Date().toISOString(),
      database: 'up',
    };
  }
}
