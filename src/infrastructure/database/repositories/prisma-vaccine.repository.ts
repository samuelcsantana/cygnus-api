import { PrismaClient } from '@prisma/client';
import { VaccineRepository } from '../../../application/vaccine/vaccine-repository';
import { Vaccine } from '../../../domain/vaccine/vaccine';

interface VaccineRecord {
  id: string;
  name: string;
  description: string;
  recommendedAgeInMonths: number;
  doseNumber: number;
}

function toDomain(record: VaccineRecord): Vaccine {
  return Vaccine.create({
    id: record.id,
    name: record.name,
    description: record.description,
    recommendedAgeInMonths: record.recommendedAgeInMonths,
    doseNumber: record.doseNumber,
  });
}

export class PrismaVaccineRepository implements VaccineRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async findAll(): Promise<Vaccine[]> {
    const records = await this.prisma.vaccine.findMany({
      orderBy: [{ recommendedAgeInMonths: 'asc' }, { doseNumber: 'asc' }],
    });
    return records.map(toDomain);
  }

  async findById(id: string): Promise<Vaccine | null> {
    const record = await this.prisma.vaccine.findUnique({ where: { id } });
    return record ? toDomain(record) : null;
  }
}
