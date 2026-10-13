import { once } from 'node:events';
import { Worker } from 'bullmq';
import { FastifyInstance } from 'fastify';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { buildApp } from '../../src/infrastructure/http/build-app';
import { prisma } from '../../src/infrastructure/database/prisma-client';
import { GenerateReminderNotificationsUseCase } from '../../src/application/notification/generate-reminder-notifications.use-case';
import { reminderDeadLetterQueue, reminderQueue, scheduleDailyReminderJob } from '../../src/infrastructure/queue/reminder-queue';
import { createReminderWorker } from '../../src/infrastructure/queue/reminder-worker';
import { demoAccountQueue, scheduleDemoAccountSweep } from '../../src/infrastructure/queue/demo-account-queue';
import { createDemoAccountWorker } from '../../src/infrastructure/queue/demo-account-worker';
import type { DeadLetterPayload } from '../../src/infrastructure/queue/dead-letter';

/**
 * The two BullMQ queues, run as main.ts runs them: the real schedulers, the real workers, the
 * real Redis (logical database /1) and the real repositories. The use cases have unit tests with
 * fakes; what only this spec shows is that the wiring holds - the scheduler fires at once, the
 * worker reaches the database, and a job that gives up lands where a human will look.
 */
describe('background workers', () => {
  let app: FastifyInstance;
  let reminderWorker: Worker | undefined;
  let demoAccountWorker: Worker | undefined;

  async function signUp(email: string): Promise<Record<string, string>> {
    await app.inject({ method: 'POST', url: '/auth/register', payload: { email, password: 'S3cur3-Password', name: 'Parent' } });
    const login = await app.inject({ method: 'POST', url: '/auth/login', payload: { email, password: 'S3cur3-Password' } });
    const cookies = [login.headers['set-cookie']].flat().filter((value): value is string => typeof value === 'string');
    const csrf = cookies.find((value) => value.startsWith('csrf_token='))?.split(';')[0]?.split('=')[1] ?? '';
    return { cookie: cookies.map((value) => value.split(';')[0]).join('; '), 'x-csrf-token': csrf };
  }

  beforeAll(async () => {
    app = await buildApp();
    await app.ready();
    // Schedulers and jobs persist in Redis between runs. Left over, an existing repeatable job would
    // not fire `immediately` again and the first test would wait for 08:00.
    await Promise.all([reminderQueue, reminderDeadLetterQueue, demoAccountQueue].map((queue) => queue.obliterate({ force: true })));
    await prisma.user.deleteMany();
  });

  afterAll(async () => {
    await reminderWorker?.close();
    await demoAccountWorker?.close();
    await Promise.all([reminderQueue, reminderDeadLetterQueue, demoAccountQueue].map((queue) => queue.obliterate({ force: true })));
    await Promise.all([reminderQueue, reminderDeadLetterQueue, demoAccountQueue].map((queue) => queue.close()));
    await prisma.user.deleteMany();
    await app.close();
    await prisma.$disconnect();
  });

  describe('the reminder sweep', () => {
    it('runs as soon as it is scheduled and reminds about an appointment due tomorrow, once', async () => {
      const session = await signUp('reminder-sweep@example.com');
      const baby = await app.inject({ method: 'POST', url: '/babies', headers: session, payload: { name: 'Helena', birthDate: '2026-04-01' } });
      const babyId = baby.json().id;
      const tomorrow = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
      const appointment = await app.inject({
        method: 'POST',
        url: `/babies/${babyId}/appointments`,
        headers: session,
        payload: { scheduledAt: tomorrow, doctorName: 'Dra. Ana Ribeiro' },
      });

      reminderWorker = createReminderWorker();
      const firstRun = once(reminderWorker, 'completed');
      await scheduleDailyReminderJob();
      await firstRun;

      const reminders = { babyId, type: 'APPOINTMENT_UPCOMING' as const, referenceId: appointment.json().id };
      expect(await prisma.notification.count({ where: reminders })).toBe(1);

      // A second sweep, as the next boot or a retry would run it, finds the reminder already there.
      const secondRun = once(reminderWorker, 'completed');
      await reminderQueue.add('sweep-again', {}, { attempts: 1 });
      await secondRun;

      expect(await prisma.notification.count({ where: reminders })).toBe(1);
    });

    it('moves a sweep that has used up its attempts to the dead letter queue', async () => {
      vi.spyOn(GenerateReminderNotificationsUseCase.prototype, 'execute').mockRejectedValue(new Error('database is in recovery'));
      reminderWorker ??= createReminderWorker();

      const failed = once(reminderWorker, 'failed');
      await reminderQueue.add('doomed-sweep', { trigger: 'test' }, { attempts: 1 });
      await failed;

      // The copy is written after the `failed` event, without being awaited by the worker.
      await vi.waitFor(async () => expect(await reminderDeadLetterQueue.count()).toBe(1), { timeout: 5_000 });
      const [letter] = await reminderDeadLetterQueue.getJobs(['waiting']);
      const payload = letter?.data as DeadLetterPayload;
      expect(payload).toMatchObject({
        originalJobName: 'doomed-sweep',
        originalData: { trigger: 'test' },
        attemptsMade: 1,
        failedReason: 'database is in recovery',
      });
      vi.restoreAllMocks();
    });
  });

  describe('the demo account sweep', () => {
    it('runs as soon as it is scheduled and deletes only the demo accounts that have expired', async () => {
      const expired = await app.inject({ method: 'POST', url: '/auth/demo' });
      const live = await app.inject({ method: 'POST', url: '/auth/demo' });
      expect([expired.statusCode, live.statusCode]).toEqual([201, 201]);
      const demos = await prisma.user.findMany({ where: { demoExpiresAt: { not: null } }, orderBy: { createdAt: 'asc' } });
      expect(demos).toHaveLength(2);
      await prisma.user.update({ where: { id: demos[0]!.id }, data: { demoExpiresAt: new Date(Date.now() - 1000) } });
      await signUp('permanent@example.com');

      demoAccountWorker = createDemoAccountWorker();
      const sweep = once(demoAccountWorker, 'completed');
      await scheduleDemoAccountSweep();
      const [, result] = await sweep;

      expect(result).toEqual({ deletedCount: 1 });
      expect(await prisma.user.findUnique({ where: { id: demos[0]!.id } })).toBeNull();
      expect(await prisma.user.findUnique({ where: { id: demos[1]!.id } })).not.toBeNull();
      expect(await prisma.user.count({ where: { email: 'permanent@example.com' } })).toBe(1);
    });
  });
});
