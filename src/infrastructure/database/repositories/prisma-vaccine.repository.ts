import { PrismaClient } from '../../../generated/prisma/client';
import { VaccineRepository } from '../../../application/vaccine/vaccine-repository';
import { Vaccine } from '../../../domain/vaccine/vaccine';

interface VaccineRecord {
  id: string;
  code: string;
  name: string;
  description: string;
  guidance: string | null;
  recommendedAgeInMonths: number;
  doseNumber: number;
  recommendationKind: 'ROUTINE' | 'CONDITIONAL' | 'RECURRING';
  scheduleVersion: string;
  effectiveFrom: Date;
  effectiveTo: Date | null;
  isActive: boolean;
}

function toDomain(record: VaccineRecord): Vaccine {
  return Vaccine.create({
    id: record.id,
    code: record.code,
    name: record.name,
    description: record.description,
    guidance: record.guidance,
    recommendedAgeInMonths: record.recommendedAgeInMonths,
    doseNumber: record.doseNumber,
    recommendationKind: record.recommendationKind,
    scheduleVersion: record.scheduleVersion,
    effectiveFrom: record.effectiveFrom,
    effectiveTo: record.effectiveTo,
    isActive: record.isActive,
  });
}

export class PrismaVaccineRepository implements VaccineRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async findAll(): Promise<Vaccine[]> {
    const records = await this.prisma.vaccine.findMany({
      where: { isActive: true },
      orderBy: [{ recommendedAgeInMonths: 'asc' }, { doseNumber: 'asc' }],
    });
    return records.map(toDomain);
  }

  async findById(id: string): Promise<Vaccine | null> {
    const record = await this.prisma.vaccine.findFirst({ where: { id, isActive: true } });
    return record ? toDomain(record) : null;
  }
}
