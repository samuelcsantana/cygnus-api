import { PrismaClient } from '../../../generated/prisma/client';
import { SpecialistRepository } from '../../../application/specialist/specialist-repository';
import { Specialist } from '../../../domain/specialist/specialist';

interface SpecialistRow {
  id: string;
  babyId: string;
  name: string;
  specialty: string | null;
  phone: string | null;
  createdAt: Date;
}

function toDomain(row: SpecialistRow): Specialist {
  return Specialist.restore({
    id: row.id,
    babyId: row.babyId,
    name: row.name,
    specialty: row.specialty,
    phone: row.phone,
    createdAt: row.createdAt,
  });
}

export class PrismaSpecialistRepository implements SpecialistRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async findById(id: string): Promise<Specialist | null> {
    const row = await this.prisma.specialist.findUnique({ where: { id } });
    return row ? toDomain(row) : null;
  }

  // By name, not by creation date: this list is read to find somebody, and the order that helps is
  // the one an address book uses.
  async findAllByBabyId(babyId: string): Promise<Specialist[]> {
    const rows = await this.prisma.specialist.findMany({ where: { babyId }, orderBy: { name: 'asc' } });
    return rows.map(toDomain);
  }

  async save(specialist: Specialist): Promise<void> {
    await this.prisma.specialist.upsert({
      where: { id: specialist.id },
      create: {
        id: specialist.id,
        babyId: specialist.babyId,
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
    });
  }

  async delete(id: string): Promise<void> {
    await this.prisma.specialist.delete({ where: { id } });
  }
}
