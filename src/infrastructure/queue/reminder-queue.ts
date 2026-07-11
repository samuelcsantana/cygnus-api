import { Queue } from 'bullmq';
import Redis from 'ioredis';
import { env } from '../../shared/config/env';

export const REMINDER_QUEUE_NAME = 'reminders';
const DAILY_REMINDER_JOB_ID = 'generate-reminder-notifications';

// BullMQ workers issue blocking Redis commands, so queue and worker each get
// their own dedicated connection instead of sharing the cache client.
const connection = new Redis(env.REDIS_URL, { maxRetriesPerRequest: null });

export const reminderQueue = new Queue(REMINDER_QUEUE_NAME, { connection });

export async function scheduleDailyReminderJob(): Promise<void> {
  await reminderQueue.add(
    DAILY_REMINDER_JOB_ID,
    {},
    {
      jobId: DAILY_REMINDER_JOB_ID,
      // `immediately` runs the sweep once as soon as the repeatable job is
      // first registered, instead of only ever firing at the next 08:00
      // cron tick — otherwise a server that never stays up past 08:00
      // (e.g. local dev) never generates a single notification.
      repeat: { pattern: '0 8 * * *', immediately: true },
    },
  );
}
