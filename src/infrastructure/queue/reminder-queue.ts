import { Queue, type JobsOptions } from 'bullmq';
import Redis from 'ioredis';
import { env } from '../../shared/config/env';
import { REMINDER_DEAD_LETTER_QUEUE_NAME } from './dead-letter';

export const REMINDER_QUEUE_NAME = 'reminders';
const DAILY_REMINDER_JOB_ID = 'generate-reminder-notifications';

// BullMQ workers issue blocking Redis commands, so queue and worker each get
// their own dedicated connection instead of sharing the cache client.
const connection = new Redis(env.REDIS_URL, { maxRetriesPerRequest: null });

/**
 * Retry policy for the daily sweep.
 *
 * Without `attempts` BullMQ tries once, so a transient Postgres blip or a
 * Resend timeout at 08:00 used to abandon the entire day's reminders until the
 * next cron tick — 24 hours later. Exponential backoff from 30s covers roughly
 * eight minutes across five attempts (30s, 1m, 2m, 4m), which is the shape of
 * the failures this job actually sees: a dependency restarting, not a bug.
 *
 * Retrying is only safe because the sweep is idempotent: every notification is
 * gated on `NotificationRepository.existsForTrigger(babyId, type, referenceId)`,
 * so a second run over the same data writes nothing. The guarantee is at-least-once
 * delivery with an idempotent consumer, not exactly-once.
 */
export const REMINDER_JOB_OPTIONS: JobsOptions = {
  attempts: 5,
  backoff: { type: 'exponential', delay: 30_000 },
  // Keep roughly a month of successful runs for auditing, and the last hundred
  // failures — a failure is also copied to the dead letter queue, but the
  // original job keeps the full BullMQ stack trace and timings.
  removeOnComplete: { count: 30 },
  removeOnFail: { count: 100 },
};

export const reminderQueue = new Queue(REMINDER_QUEUE_NAME, { connection });

/**
 * Where jobs land once {@link REMINDER_JOB_OPTIONS.attempts} is exhausted.
 * Deliberately has no worker — see routeToDeadLetter in ./dead-letter.
 */
export const reminderDeadLetterQueue = new Queue(REMINDER_DEAD_LETTER_QUEUE_NAME, { connection });

export async function scheduleDailyReminderJob(): Promise<void> {
  await reminderQueue.add(
    DAILY_REMINDER_JOB_ID,
    {},
    {
      ...REMINDER_JOB_OPTIONS,
      jobId: DAILY_REMINDER_JOB_ID,
      // `immediately` runs the sweep once as soon as the repeatable job is
      // first registered, instead of only ever firing at the next 08:00
      // cron tick — otherwise a server that never stays up past 08:00
      // (e.g. local dev) never generates a single notification.
      repeat: { pattern: '0 8 * * *', immediately: true },
    },
  );
}
