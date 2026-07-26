import { PrismaClient } from '@prisma/client';
import { HealthChecker } from '../../domain/health/health-checker';
import { logger } from '../../shared/logging/logger';

export class PrismaHealthChecker implements HealthChecker {
  constructor(private readonly prisma: PrismaClient) {}

  async checkDatabase(): Promise<boolean> {
    try {
      await this.prisma.$queryRaw`SELECT 1`;
      return true;
    } catch (error) {
      logger.error({ err: error }, 'health.database_check_failed');
      return false;
    }
  }
}
