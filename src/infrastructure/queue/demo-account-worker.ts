import { Worker } from 'bullmq';
import Redis from 'ioredis';
import { env } from '../../shared/config/env';
import { logger } from '../../shared/logging/logger';
import { prisma } from '../database/prisma-client';
import { PrismaDemoAccountRepository } from '../database/repositories/prisma-demo-account.repository';
import { DeleteExpiredDemoAccountsUseCase } from '../../application/demo/delete-expired-demo-accounts.use-case';
import { DEMO_ACCOUNT_QUEUE_NAME } from './demo-account-queue';

const connection = new Redis(env.REDIS_URL, { maxRetriesPerRequest: null });

export function createDemoAccountWorker(): Worker {
  const deleteExpiredDemoAccounts = new DeleteExpiredDemoAccountsUseCase(new PrismaDemoAccountRepository(prisma));

  const worker = new Worker(
    DEMO_ACCOUNT_QUEUE_NAME,
    async () => {
      const deletedCount = await deleteExpiredDemoAccounts.execute();
      logger.info({ deletedCount }, 'demo_accounts.swept');
      return { deletedCount };
    },
    { connection },
  );

  worker.on('failed', (job, error) => {
    logger.error({ err: error, jobId: job?.id, attemptsMade: job?.attemptsMade }, 'demo_accounts.sweep_failed');
  });

  return worker;
}
