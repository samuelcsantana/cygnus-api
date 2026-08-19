# Queue reliability

What the reminder queue guarantees, what it does not, and why.

## What this queue is

A **task queue**, not a message broker. One producer, one consumer, one job: a daily sweep at 08:00 that walks
every baby, creates `VACCINE_DELAYED` and `APPOINTMENT_UPCOMING` notifications, and emails opted-in guardians.
BullMQ over Redis, in the same process as the API.

Calling it event-driven architecture would be a stretch, and the distinction matters: there is no broker, no
topic, no second service subscribing to anything. What follows is about making one scheduled job survive a bad
morning.

## Delivery guarantee: at-least-once

The job can run more than once over the same data — a retry, a worker restart mid-sweep, a repeatable job firing
after a clock change. It must therefore be safe to repeat, and it is:

Every notification is gated on `NotificationRepository.existsForTrigger(babyId, type, referenceId)` before it is
written. That triple is the **deduplication key**, and it is derived from the domain rather than from the job:
the same delayed vaccine for the same baby produces the same key whether it is seen on the first attempt or the
fifth. A second sweep over unchanged data writes nothing and returns `createdCount: 0`.

Exactly-once was never on the table. It would need the notification write and the email send to share a
transaction, which they cannot — one is Postgres, the other is an HTTP call to Resend.

## Retry policy

`REMINDER_JOB_OPTIONS` in `reminder-queue.ts`:

| Option | Value | Why |
|---|---|---|
| `attempts` | 5 | Unset means BullMQ tries **once**. A Postgres blip at 08:00 used to abandon the whole day's reminders until the next tick, 24 hours later. |
| `backoff` | exponential, 30s base | 30s → 1m → 2m → 4m, about eight minutes total. Matches the failure this job actually sees: a dependency restarting, not a bug that a sixth attempt would fix. |
| `removeOnComplete` | 30 | Roughly a month of successful runs, for auditing. |
| `removeOnFail` | 100 | Failures keep BullMQ's stack trace and timings, which the dead letter copy does not carry. |

Retrying is only defensible because of the dedup key above. A retry policy on a non-idempotent consumer is a
duplicate-notification generator with extra steps.

## Dead letter queue

Once `attempts` is exhausted the job is copied to `reminders-dead-letter` with enough context to diagnose and
replay it: original job id and name, its data, how many attempts were made, the failure message, and when it gave
up.

Two decisions worth stating:

**Nothing consumes it.** A job lands there precisely because automatic handling has run out of ideas; a consumer
would only recreate the failure loop at a different address. It is an inbox for a human:

```ts
const failures = await reminderDeadLetterQueue.getJobs(['waiting']);
```

Fix the cause, then replay by re-adding to the reminders queue.

**The write is allowed to fail.** Redis is usually *why* the job failed, so the dead letter write can fail too. It
is caught and logged (`reminders.dead_letter_write_failed`) rather than being allowed to take the worker down —
the original job is still in BullMQ's failed set either way.

`routeToDeadLetter` no-ops while retries remain. BullMQ's `failed` event fires after *every* attempt, not only the
last, so without that check a five-attempt job would file five reports, four of them for a job that was still
going to be retried. That is the single most likely bug in this design, so it is the one the unit tests cover most
directly (`tests/unit/infrastructure/queue/dead-letter.spec.ts`).

## The gap this does not close

**Email dispatch is best-effort and is not retried.**

`notifyGuardiansByEmail` catches per-guardian send failures and logs them, so one guardian's bad address cannot
stop the sweep. The consequence: an email that fails is simply lost. The notification row already exists, so the
next sweep's `existsForTrigger` check skips that trigger entirely and never tries to send again.

This is the classic dual-write problem — a database write and an external call that cannot share a transaction —
and neither retry nor dead-lettering touches it, because the job never fails in the first place.

Closing it properly means an **outbox**: write the notification and an `email_pending` record in the same
transaction, and let a separate consumer drain the outbox with its own retries. That is a larger change than this
one and belongs with the move to real domain events between services.

Recorded here rather than fixed so it is a known limitation instead of a silent one.

## What is safe to claim from this

- Task queue with a scheduled repeatable job, deduplicated by deterministic job id
- Retry with exponential backoff and a dead letter queue for terminal failures
- Idempotent consumer keyed on a domain-derived triple, so at-least-once delivery is safe
- Delivery guarantee chosen deliberately and its one gap documented

Not: message broker, Kafka, domain events between services, exactly-once, or the outbox pattern.
