import { PrismaClient } from '@prisma/client';
import { MilestoneRepository } from '../../../application/milestone/milestone-repository';
import { Milestone, MilestoneCategory } from '../../../domain/milestone/milestone';

interface MilestoneRow {
  id: string;
  babyId: string;
  title: string;
  description: string | null;
  achievedAt: Date;
  category: string;
  photoUrl: string | null;
  createdAt: Date;
}

function toDomain(row: MilestoneRow): Milestone {
  return Milestone.restore({
    id: row.id,
    babyId: row.babyId,
    title: row.title,
    description: row.description,
    achievedAt: row.achievedAt,
    category: row.category as MilestoneCategory,
    photoUrl: row.photoUrl,
    createdAt: row.createdAt,
  });
}

export class PrismaMilestoneRepository implements MilestoneRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async findById(id: string): Promise<Milestone | null> {
    const row = await this.prisma.milestone.findUnique({ where: { id } });
    return row ? toDomain(row) : null;
  }

  async findAllByBabyId(babyId: string): Promise<Milestone[]> {
    const rows = await this.prisma.milestone.findMany({ where: { babyId }, orderBy: { achievedAt: 'asc' } });
    return rows.map(toDomain);
  }

  async save(milestone: Milestone): Promise<void> {
    await this.prisma.milestone.upsert({
      where: { id: milestone.id },
      create: {
        id: milestone.id,
        babyId: milestone.babyId,
        title: milestone.title,
        description: milestone.description,
        achievedAt: milestone.achievedAt,
        category: milestone.category,
        photoUrl: milestone.photoUrl,
        createdAt: milestone.createdAt,
      },
      update: {
        title: milestone.title,
        description: milestone.description,
        achievedAt: milestone.achievedAt,
        category: milestone.category,
        photoUrl: milestone.photoUrl,
      },
    });
  }
}
