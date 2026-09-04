import { PrismaClient } from '../../../generated/prisma/client';
import { SpecialistRepository } from '../../../application/specialist/specialist-repository';
import { Specialist } from '../../../domain/specialist/specialist';

interface SpecialistRow {
  id: string;
  userId: string;
  name: string;
  specialty: string | null;
  phone: string | null;
  createdAt: Date;
  babies: { babyId: string }[];
  shares: { userId: string }[];
}

function toDomain(row: SpecialistRow): Specialist {
  return Specialist.restore({
    id: row.id,
    userId: row.userId,
    name: row.name,
    specialty: row.specialty,
    phone: row.phone,
    babyIds: row.babies.map((link) => link.babyId),
    sharedWithUserIds: row.shares.map((share) => share.userId),
    createdAt: row.createdAt,
  });
}

const WITH_LINKS = {
  babies: { select: { babyId: true } },
  shares: { select: { userId: true } },
} as const;

export class PrismaSpecialistRepository implements SpecialistRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async findById(id: string): Promise<Specialist | null> {
    const row = await this.prisma.specialist.findUnique({ where: { id }, include: WITH_LINKS });
    return row ? toDomain(row) : null;
  }

  async findAllVisibleTo(userId: string): Promise<Specialist[]> {
    const rows = await this.prisma.specialist.findMany({
      where: {
        OR: [
          // criou
          { userId },
          // compartilhado por nome
          { shares: { some: { userId } } },
          // ligado a uma criança que esta pessoa alcança — o acesso é decidido pelo `BabyGuardian`,
          // e não por `Baby.userId`, porque é ele que manda desde a partilha de guarda
          { babies: { some: { baby: { guardians: { some: { userId } } } } } },
        ],
      },
      include: WITH_LINKS,
      orderBy: { name: 'asc' },
    });
    return rows.map(toDomain);
  }

  /**
   * Grava o profissional e **substitui** os vínculos, em transação.
   *
   * Substituir e não mesclar: a tela manda a lista inteira de crianças e de compartilhamentos, e
   * mesclar tornaria impossível desmarcar a última criança — a operação que "atende nenhuma"
   * exige. Tudo numa transação porque um apagar que passa e um inserir que falha deixaria o
   * profissional visível para menos gente do que a pessoa pediu, sem aviso.
   */
  async save(specialist: Specialist): Promise<void> {
    await this.prisma.$transaction([
      this.prisma.specialist.upsert({
        where: { id: specialist.id },
        create: {
          id: specialist.id,
          userId: specialist.userId,
          name: specialist.name,
          specialty: specialist.specialty,
          phone: specialist.phone,
          createdAt: specialist.createdAt,
        },
        update: {
          name: specialist.name,
          specialty: specialist.specialty,
          phone: specialist.phone,
        },
      }),
      this.prisma.specialistBaby.deleteMany({ where: { specialistId: specialist.id } }),
      this.prisma.specialistBaby.createMany({
        data: specialist.babyIds.map((babyId) => ({ specialistId: specialist.id, babyId })),
      }),
      this.prisma.specialistShare.deleteMany({ where: { specialistId: specialist.id } }),
      this.prisma.specialistShare.createMany({
        data: specialist.sharedWithUserIds.map((userId) => ({ specialistId: specialist.id, userId })),
      }),
    ]);
  }

  async delete(id: string): Promise<void> {
    await this.prisma.specialist.delete({ where: { id } });
  }
}
