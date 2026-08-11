import { PrismaClient } from '@prisma/client';
import { BabyGuardianRepository } from '../../../application/baby/baby-guardian-repository';
import { BabyGuardian, GuardianRole } from '../../../domain/baby/baby-guardian';

interface BabyGuardianRow {
  id: string;
  babyId: string;
  userId: string;
  role: string;
  createdAt: Date;
}

function toDomain(row: BabyGuardianRow): BabyGuardian {
  return BabyGuardian.restore({
    id: row.id,
    babyId: row.babyId,
    userId: row.userId,
    role: row.role as GuardianRole,
    createdAt: row.createdAt,
  });
}

export class PrismaBabyGuardianRepository implements BabyGuardianRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async findByBabyAndUser(babyId: string, userId: string): Promise<BabyGuardian | null> {
    const row = await this.prisma.babyGuardian.findUnique({
      where: { babyId_userId: { babyId, userId } },
    });
    return row ? toDomain(row) : null;
  }

  async findAllByBaby(babyId: string): Promise<BabyGuardian[]> {
    const rows = await this.prisma.babyGuardian.findMany({ where: { babyId }, orderBy: { createdAt: 'asc' } });
    return rows.map(toDomain);
  }

  async findAllByUser(userId: string): Promise<BabyGuardian[]> {
    const rows = await this.prisma.babyGuardian.findMany({ where: { userId }, orderBy: { createdAt: 'asc' } });
    return rows.map(toDomain);
  }

  async create(babyId: string, userId: string, role: GuardianRole = 'GUARDIAN'): Promise<BabyGuardian> {
    const row = await this.prisma.babyGuardian.create({
      data: { babyId, userId, role },
    });
    return toDomain(row);
  }

  async delete(babyId: string, userId: string): Promise<void> {
    await this.prisma.babyGuardian.delete({
      where: { babyId_userId: { babyId, userId } },
    });
  }
}
