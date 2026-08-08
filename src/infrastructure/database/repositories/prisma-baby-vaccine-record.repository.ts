import { PrismaClient } from '@prisma/client';
import { BabyVaccineRecordRepository } from '../../../application/vaccine/baby-vaccine-record-repository';
import { BabyVaccineRecord, VaccineRecordSource, VaccineRecordStatus } from '../../../domain/vaccine/baby-vaccine-record';

interface BabyVaccineRecordRow {
  id: string;
  babyId: string;
  vaccineId: string | null;
  source: string;
  customName: string | null;
  customDose: string | null;
  status: string;
  applicationDate: Date | null;
  notes: string | null;
  batchNumber: string | null;
  location: string | null;
  professional: string | null;
  photoUrl: string | null;
}

function toDomain(record: BabyVaccineRecordRow): BabyVaccineRecord {
  return BabyVaccineRecord.restore({
    id: record.id,
    babyId: record.babyId,
    vaccineId: record.vaccineId,
    source: record.source as VaccineRecordSource,
    customName: record.customName,
    customDose: record.customDose,
    status: record.status as VaccineRecordStatus,
    applicationDate: record.applicationDate,
    notes: record.notes,
    batchNumber: record.batchNumber,
    location: record.location,
    professional: record.professional,
    photoUrl: record.photoUrl,
  });
}

export class PrismaBabyVaccineRecordRepository implements BabyVaccineRecordRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async findById(id: string): Promise<BabyVaccineRecord | null> {
    const record = await this.prisma.babyVaccineRecord.findUnique({ where: { id } });
    return record ? toDomain(record) : null;
  }

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
    if (!record.vaccineId) {
      throw new Error('save() requires a catalog record with a vaccineId — use create() for adhoc records');
    }

    await this.prisma.babyVaccineRecord.upsert({
      where: { babyId_vaccineId: { babyId: record.babyId, vaccineId: record.vaccineId } },
      create: {
        id: record.id,
        babyId: record.babyId,
        vaccineId: record.vaccineId,
        source: record.source,
        status: record.status,
        applicationDate: record.applicationDate,
        notes: record.notes,
        batchNumber: record.batchNumber,
        location: record.location,
        professional: record.professional,
        photoUrl: record.photoUrl,
      },
      update: {
        status: record.status,
        applicationDate: record.applicationDate,
        notes: record.notes,
        batchNumber: record.batchNumber,
        location: record.location,
        professional: record.professional,
        photoUrl: record.photoUrl,
      },
    });
  }

  async create(record: BabyVaccineRecord): Promise<void> {
    await this.prisma.babyVaccineRecord.create({
      data: {
        id: record.id,
        babyId: record.babyId,
        vaccineId: record.vaccineId,
        source: record.source,
        customName: record.customName,
        customDose: record.customDose,
        status: record.status,
        applicationDate: record.applicationDate,
        notes: record.notes,
        batchNumber: record.batchNumber,
        location: record.location,
        professional: record.professional,
        photoUrl: record.photoUrl,
      },
    });
  }

  async delete(id: string): Promise<void> {
    await this.prisma.babyVaccineRecord.delete({ where: { id } });
  }
}
