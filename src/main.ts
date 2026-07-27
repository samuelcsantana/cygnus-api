import { buildApp } from './infrastructure/http/build-app';
import { env } from './shared/config/env';
import { logger } from './shared/logging/logger';
import { prisma } from './infrastructure/database/prisma-client';
import { redis } from './infrastructure/cache/redis-client';
import { reminderQueue, scheduleDailyReminderJob } from './infrastructure/queue/reminder-queue';
import { createReminderWorker } from './infrastructure/queue/reminder-worker';

async function start() {
  const app = await buildApp();
  const reminderWorker = createReminderWorker();
  await scheduleDailyReminderJob();

  const shutdown = async (signal: string) => {
    logger.info({ signal }, 'server.shutting_down');
    await app.close();
    await reminderWorker.close();
    await reminderQueue.close();
    await prisma.$disconnect();
    await redis.quit();
    process.exit(0);
  };

  process.on('SIGINT', () => void shutdown('SIGINT'));
  process.on('SIGTERM', () => void shutdown('SIGTERM'));

  try {
    await app.listen({ port: env.PORT, host: env.HOST });
    logger.info('reminders.worker_started');
  } catch (error) {
    logger.error({ err: error }, 'server.failed_to_start');
    process.exit(1);
  }
}

void start();
