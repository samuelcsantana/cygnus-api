import { PrismaClient } from '../../../generated/prisma/client';
import { DemoAccountRepository } from '../../../application/demo/demo-account-repository';
import { DemoDataset } from '../../../application/demo/demo-dataset';

export class PrismaDemoAccountRepository implements DemoAccountRepository {
  constructor(private readonly prisma: PrismaClient) {}

  /**
   * One batched transaction of about a dozen statements, not the sixty-odd single-row writes the
   * feature repositories would make. Render's free instance and Neon sit in different data centres,
   * so every round trip is paid in latency on the visitor's first click; and the batch is atomic, so
   * a failure leaves no half-seeded account behind.
   */
  async create(dataset: DemoDataset): Promise<void> {
    const { user, babies } = dataset;
    const userId = user.id;

    await this.prisma.$transaction([
      this.prisma.user.create({
        data: {
          id: userId,
          email: user.email,
          passwordHash: user.passwordHash,
          name: user.name,
          avatarUrl: user.avatarUrl,
          emailNotificationsEnabled: user.emailNotificationsEnabled,
          createdAt: user.createdAt,
          sessionVersion: user.sessionVersion,
          demoExpiresAt: user.demoExpiresAt,
        },
      }),
      this.prisma.baby.createMany({ data: babies.map((baby) => ({ ...baby, userId })) }),
      // Access is decided by guardian rows, not by `Baby.userId`: without these the account could
      // not open the children it was just given.
      this.prisma.babyGuardian.createMany({
        data: babies.map((baby) => ({ babyId: baby.id, userId, role: 'OWNER' as const })),
      }),
      this.prisma.babyMeasurement.createMany({ data: dataset.measurements }),
      this.prisma.babyVaccineRecord.createMany({
        data: dataset.vaccineRecords.map((record) => ({ ...record, source: 'CATALOG' as const, status: 'APPLIED' as const })),
      }),
      this.prisma.specialist.createMany({
        data: dataset.specialists.map(({ babyIds: _babyIds, ...specialist }) => ({ ...specialist, userId })),
      }),
      this.prisma.specialistBaby.createMany({
        data: dataset.specialists.flatMap((specialist) =>
          specialist.babyIds.map((babyId) => ({ specialistId: specialist.id, babyId })),
        ),
      }),
      this.prisma.appointment.createMany({ data: dataset.appointments }),
      this.prisma.milestone.createMany({ data: dataset.milestones }),
      this.prisma.medication.createMany({ data: dataset.medications }),
    ]);
  }

  /**
   * Deleting the user is enough for everything the account owns — babies, records, appointments,
   * specialists, guardianships and notifications all cascade from it.
   *
   * The audit log is the exception: `audit_logs.user_id` is a plain column, not a foreign key, so
   * the trail of a visitor marking doses on a fictional child would outlive the child. It is removed
   * in the same transaction. A real account's deletion keeps its trail; this one has no person
   * behind it to account for.
   */
  async deleteExpired(now: Date): Promise<number> {
    const expired = await this.prisma.user.findMany({
      where: { demoExpiresAt: { lte: now } },
      select: { id: true },
    });

    if (expired.length === 0) {
      return 0;
    }

    const ids = expired.map(({ id }) => id);

    const [, deletedUsers] = await this.prisma.$transaction([
      this.prisma.auditLog.deleteMany({ where: { userId: { in: ids } } }),
      // Repeats the expiry condition instead of trusting `ids` alone, so this statement can only
      // ever delete demo accounts — a real one has no expiry to match.
      this.prisma.user.deleteMany({ where: { id: { in: ids }, demoExpiresAt: { lte: now } } }),
    ]);

    return deletedUsers.count;
  }
}
