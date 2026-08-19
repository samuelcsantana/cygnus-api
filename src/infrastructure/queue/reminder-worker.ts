import { Worker } from 'bullmq';
import Redis from 'ioredis';
import { env } from '../../shared/config/env';
import { logger } from '../../shared/logging/logger';
import { prisma } from '../database/prisma-client';
import { PrismaBabyRepository } from '../database/repositories/prisma-baby.repository';
import { PrismaVaccineRepository } from '../database/repositories/prisma-vaccine.repository';
import { PrismaBabyVaccineRecordRepository } from '../database/repositories/prisma-baby-vaccine-record.repository';
import { PrismaAppointmentRepository } from '../database/repositories/prisma-appointment.repository';
import { PrismaNotificationRepository } from '../database/repositories/prisma-notification.repository';
import { PrismaBabyGuardianRepository } from '../database/repositories/prisma-baby-guardian.repository';
import { PrismaUserRepository } from '../database/repositories/prisma-user.repository';
import { emailService } from '../email/email-service.instance';
import { GenerateReminderNotificationsUseCase } from '../../application/notification/generate-reminder-notifications.use-case';
import { REMINDER_QUEUE_NAME, reminderDeadLetterQueue } from './reminder-queue';
import { routeToDeadLetter } from './dead-letter';

const connection = new Redis(env.REDIS_URL, { maxRetriesPerRequest: null });

export function createReminderWorker(): Worker {
  // Uses the plain (non-cached) vaccine repository so the daily sweep always
  // sees the catalog as it is right now, regardless of the HTTP-facing cache TTL.
  const generateReminderNotificationsUseCase = new GenerateReminderNotificationsUseCase(
    new PrismaBabyRepository(prisma),
    new PrismaVaccineRepository(prisma),
    new PrismaBabyVaccineRecordRepository(prisma),
    new PrismaAppointmentRepository(prisma),
    new PrismaNotificationRepository(prisma),
    new PrismaBabyGuardianRepository(prisma),
    new PrismaUserRepository(prisma),
    emailService,
  );

  const worker = new Worker(
    REMINDER_QUEUE_NAME,
    async () => {
      const result = await generateReminderNotificationsUseCase.execute();
      logger.info({ createdCount: result.createdCount }, 'reminders.generated');
      return result;
    },
    { connection },
  );

  // Fires after every failed attempt, not just the last — routeToDeadLetter
  // no-ops while BullMQ still intends to retry, so the log line below is the
  // record of each attempt and the dead letter entry is the record of giving up.
  worker.on('failed', (job, error) => {
    logger.error(
      { err: error, jobId: job?.id, attemptsMade: job?.attemptsMade },
      'reminders.job_failed',
    );

    if (!job) {
      return;
    }

    void routeToDeadLetter(reminderDeadLetterQueue, job, error)
      .then((deadLettered) => {
        if (deadLettered) {
          logger.error(
            { jobId: job.id, attemptsMade: job.attemptsMade },
            'reminders.job_dead_lettered',
          );
        }
      })
      .catch((deadLetterError: unknown) => {
        // Redis is almost certainly the reason the job failed in the first
        // place, so this write can fail too. Losing the dead letter copy must
        // not take the worker process down — the original job is still in
        // BullMQ's failed set with its stack trace.
        logger.error(
          { err: deadLetterError, jobId: job.id },
          'reminders.dead_letter_write_failed',
        );
      });
  });

  return worker;
}
