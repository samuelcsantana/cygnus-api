import { describe, expect, it, vi } from 'vitest';
import {
  hasExhaustedRetries,
  routeToDeadLetter,
  toDeadLetterPayload,
  type DeadLetterSink,
  type FailedJobSnapshot,
} from '../../../../src/infrastructure/queue/dead-letter';

function buildFailedJob(overrides: Partial<FailedJobSnapshot> = {}): FailedJobSnapshot {
  return {
    id: 'generate-reminder-notifications',
    name: 'generate-reminder-notifications',
    data: {},
    attemptsMade: 5,
    opts: { attempts: 5 },
    ...overrides,
  };
}

function buildSink(): DeadLetterSink & { add: ReturnType<typeof vi.fn> } {
  return { add: vi.fn().mockResolvedValue(undefined) };
}

describe('hasExhaustedRetries', () => {
  it('is false while BullMQ still intends to retry', () => {
    expect(hasExhaustedRetries(buildFailedJob({ attemptsMade: 1, opts: { attempts: 5 } }))).toBe(false);
    expect(hasExhaustedRetries(buildFailedJob({ attemptsMade: 4, opts: { attempts: 5 } }))).toBe(false);
  });

  it('is true on the final attempt', () => {
    expect(hasExhaustedRetries(buildFailedJob({ attemptsMade: 5, opts: { attempts: 5 } }))).toBe(true);
  });

  // BullMQ's own default when `attempts` is unset is a single try, so the
  // first failure is already terminal — a job added without our options must
  // not sit undead, never retried and never dead-lettered.
  it('treats a job with no configured attempts as terminal on first failure', () => {
    expect(hasExhaustedRetries(buildFailedJob({ attemptsMade: 1, opts: {} }))).toBe(true);
  });
});

describe('toDeadLetterPayload', () => {
  it('carries enough to diagnose and replay the job', () => {
    const failedAt = new Date('2026-08-19T08:04:00.000Z');
    const job = buildFailedJob({ data: { sweep: 'daily' }, attemptsMade: 5 });

    expect(toDeadLetterPayload(job, new Error('connect ECONNREFUSED'), failedAt)).toEqual({
      originalJobId: 'generate-reminder-notifications',
      originalJobName: 'generate-reminder-notifications',
      originalData: { sweep: 'daily' },
      attemptsMade: 5,
      failedReason: 'connect ECONNREFUSED',
      failedAt: '2026-08-19T08:04:00.000Z',
    });
  });

  it('records a null id rather than dropping the field when BullMQ has none', () => {
    const payload = toDeadLetterPayload(
      buildFailedJob({ id: undefined }),
      new Error('boom'),
      new Date('2026-08-19T08:04:00.000Z'),
    );

    expect(payload.originalJobId).toBeNull();
  });
});

describe('routeToDeadLetter', () => {
  // The `failed` event fires once per attempt. Dead-lettering on every one of
  // them would file five reports for a job that was still going to be retried.
  it('does not write while retries remain', async () => {
    const sink = buildSink();

    const deadLettered = await routeToDeadLetter(
      sink,
      buildFailedJob({ attemptsMade: 2, opts: { attempts: 5 } }),
      new Error('transient'),
    );

    expect(deadLettered).toBe(false);
    expect(sink.add).not.toHaveBeenCalled();
  });

  it('writes once when retries are exhausted', async () => {
    const sink = buildSink();
    const failedAt = new Date('2026-08-19T08:04:00.000Z');

    const deadLettered = await routeToDeadLetter(
      sink,
      buildFailedJob({ attemptsMade: 5, opts: { attempts: 5 } }),
      new Error('permanent'),
      failedAt,
    );

    expect(deadLettered).toBe(true);
    expect(sink.add).toHaveBeenCalledTimes(1);
    expect(sink.add).toHaveBeenCalledWith(
      'generate-reminder-notifications',
      expect.objectContaining({ failedReason: 'permanent', attemptsMade: 5 }),
    );
  });

  it('propagates a sink failure so the caller can log it instead of losing it silently', async () => {
    const sink = buildSink();
    sink.add.mockRejectedValue(new Error('redis down'));

    await expect(
      routeToDeadLetter(sink, buildFailedJob(), new Error('permanent')),
    ).rejects.toThrow('redis down');
  });
});
