export const REMINDER_DEAD_LETTER_QUEUE_NAME = 'reminders-dead-letter';

/** The subset of a BullMQ job this module needs, so it can be exercised without Redis. */
export interface FailedJobSnapshot {
  id?: string | undefined;
  name: string;
  data: unknown;
  attemptsMade: number;
  opts: { attempts?: number | undefined };
}

/** What a dead-lettered job carries: enough to diagnose it, and to replay it by hand. */
export interface DeadLetterPayload {
  originalJobId: string | null;
  originalJobName: string;
  originalData: unknown;
  attemptsMade: number;
  failedReason: string;
  failedAt: string;
}

/** The write side of a BullMQ Queue, narrowed to what dead-lettering uses. */
export interface DeadLetterSink {
  add(name: string, data: DeadLetterPayload): Promise<unknown>;
}

/**
 * Whether BullMQ is done retrying this job.
 *
 * The `failed` event fires after *every* failed attempt, not only the last
 * one, so without this check a job configured for 5 attempts would be
 * dead-lettered 5 times — four of those while it was still going to be
 * retried and might yet succeed.
 *
 * `attempts` defaults to 1 when unset, matching BullMQ: no configuration means
 * no retries, so the first failure is already terminal.
 */
export function hasExhaustedRetries(job: FailedJobSnapshot): boolean {
  return job.attemptsMade >= (job.opts.attempts ?? 1);
}

export function toDeadLetterPayload(job: FailedJobSnapshot, error: Error, failedAt: Date): DeadLetterPayload {
  return {
    originalJobId: job.id ?? null,
    originalJobName: job.name,
    originalData: job.data,
    attemptsMade: job.attemptsMade,
    failedReason: error.message,
    failedAt: failedAt.toISOString(),
  };
}

/**
 * Moves a permanently-failed job onto the dead letter queue.
 *
 * No-ops while retries remain, so callers can wire this straight to the
 * `failed` event without repeating the exhaustion check.
 *
 * Nothing consumes the dead letter queue. That is the point: a job lands there
 * precisely because automatic handling has run out of ideas, and a consumer
 * would only recreate the failure loop. It is an inbox for a human — inspect
 * with `reminderDeadLetterQueue.getJobs(['waiting'])`, fix the cause, then
 * replay by re-adding to the reminders queue.
 */
export async function routeToDeadLetter(
  sink: DeadLetterSink,
  job: FailedJobSnapshot,
  error: Error,
  failedAt: Date = new Date(),
): Promise<boolean> {
  if (!hasExhaustedRetries(job)) {
    return false;
  }

  await sink.add(job.name, toDeadLetterPayload(job, error, failedAt));

  return true;
}
