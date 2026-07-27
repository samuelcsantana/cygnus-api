import { PrismaClient } from '@prisma/client';
import { BabyVaccineRecordRepository } from '../../../application/vaccine/baby-vaccine-record-repository';
import { BabyVaccineRecord, VaccineRecordStatus } from '../../../domain/vaccine/baby-vaccine-record';

interface BabyVaccineRecordRow {
  id: string;
  babyId: string;
  vaccineId: string;
  status: string;
  applicationDate: Date | null;
  notes: string | null;
}

function toDomain(record: BabyVaccineRecordRow): BabyVaccineRecord {
  return BabyVaccineRecord.restore({
    id: record.id,
    babyId: record.babyId,
    vaccineId: record.vaccineId,
    status: record.status as VaccineRecordStatus,
    applicationDate: record.applicationDate,
    notes: record.notes,
  });
}

export class PrismaBabyVaccineRecordRepository implements BabyVaccineRecordRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async findAllByBabyId(babyId: string): Promise<BabyVaccineRecord[]> {
    const records = await this.prisma.babyVaccineRecord.findMany({ where: { babyId } });
    return records.map(toDomain);
  }

  async findByBabyAndVaccine(babyId: string, vaccineId: string): Promise<BabyVaccineRecord | null> {
    const record = await this.prisma.babyVaccineRecord.findUnique({
      where: { babyId_vaccineId: { babyId, vaccineId } },
    });
    return record ? toDomain(record) : null;
  }

  async save(record: BabyVaccineRecord): Promise<void> {
    await this.prisma.babyVaccineRecord.upsert({
      where: { babyId_vaccineId: { babyId: record.babyId, vaccineId: record.vaccineId } },
      create: {
        id: record.id,
        babyId: record.babyId,
        vaccineId: record.vaccineId,
        status: record.status,
        applicationDate: record.applicationDate,
        notes: record.notes,
      },
      update: {
        status: record.status,
        applicationDate: record.applicationDate,
        notes: record.notes,
      },
    });
  }
}
