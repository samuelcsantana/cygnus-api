import { Queue } from 'bullmq';
import Redis from 'ioredis';
import { env } from '../../shared/config/env';

export const DEMO_ACCOUNT_QUEUE_NAME = 'demo-accounts';
const SWEEP_SCHEDULER_ID = 'sweep-expired-demo-accounts';

// Its own connection, like the reminder queue's: the worker on the other end issues blocking commands.
const connection = new Redis(env.REDIS_URL, { maxRetriesPerRequest: null });

export const demoAccountQueue = new Queue(DEMO_ACCOUNT_QUEUE_NAME, { connection });

/**
 * Deletes expired demo accounts every hour, on the hour, and once at boot.
 *
 * A sweep, not a delayed job per account: a lost or failed job leaves nothing behind that the next
 * tick will not find, and the work is one indexed query however many accounts there are.
 *
 * On Render's free plan the instance sleeps after fifteen idle minutes, and nothing runs while it
 * sleeps. That is acceptable here for two reasons. Redis keeps the schedule, so the tick that fell
 * due during the nap runs as soon as the instance wakes, and `immediately` sweeps at every boot as
 * well; and an expired demo cannot be used meanwhile, because its refresh is refused at the expiry
 * itself (`RefreshUserSessionUseCase`). The sweep only decides when the rows leave the database.
 *
 * No dead letter queue, unlike the reminders: a sweep that keeps failing loses nothing, because the
 * next hour's run covers exactly the same accounts. The failure is logged by the worker.
 *
 * `upsertJobScheduler` rather than `add` with `repeat`: job schedulers replaced repeatable jobs in
 * BullMQ 5.16, and upserting by id leaves a single schedule however many times the process boots.
 */
export async function scheduleDemoAccountSweep(): Promise<void> {
  await demoAccountQueue.upsertJobScheduler(
    SWEEP_SCHEDULER_ID,
    { pattern: '0 * * * *', immediately: true },
    {
      name: SWEEP_SCHEDULER_ID,
      opts: {
        attempts: 3,
        backoff: { type: 'exponential', delay: 30_000 },
        removeOnComplete: { count: 24 },
        removeOnFail: { count: 50 },
      },
    },
  );
}
