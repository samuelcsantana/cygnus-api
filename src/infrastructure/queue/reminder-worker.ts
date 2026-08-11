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
import { REMINDER_QUEUE_NAME } from './reminder-queue';

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

  worker.on('failed', (job, error) => {
    logger.error({ err: error, jobId: job?.id }, 'reminders.job_failed');
  });

  return worker;
}
