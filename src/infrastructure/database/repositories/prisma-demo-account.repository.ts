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
}
