import { PrismaClient } from '../../../generated/prisma/client';
import { MedicationRepository } from '../../../application/medication/medication-repository';
import { Medication } from '../../../domain/medication/medication';

interface MedicationRow {
  id: string;
  babyId: string;
  name: string;
  dosage: string | null;
  frequency: string | null;
  reason: string | null;
  prescriberName: string | null;
  startedOn: Date;
  endedOn: Date | null;
  notes: string | null;
  createdAt: Date;
}

function toDomain(row: MedicationRow): Medication {
  return Medication.restore({
    id: row.id,
    babyId: row.babyId,
    name: row.name,
    dosage: row.dosage,
    frequency: row.frequency,
    reason: row.reason,
    prescriberName: row.prescriberName,
    startedOn: row.startedOn,
    endedOn: row.endedOn,
    notes: row.notes,
    createdAt: row.createdAt,
  });
}

export class PrismaMedicationRepository implements MedicationRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async findById(id: string): Promise<Medication | null> {
    const row = await this.prisma.medication.findUnique({ where: { id } });
    return row ? toDomain(row) : null;
  }

  // Most recently started first: what a parent is looking for is almost always the current course
  // or the one just before it, and the oldest entries are the ones nobody scrolls to.
  async findAllByBabyId(babyId: string): Promise<Medication[]> {
    const rows = await this.prisma.medication.findMany({ where: { babyId }, orderBy: { startedOn: 'desc' } });
    return rows.map(toDomain);
  }

  async save(medication: Medication): Promise<void> {
    await this.prisma.medication.upsert({
      where: { id: medication.id },
      create: {
        id: medication.id,
        babyId: medication.babyId,
        name: medication.name,
        dosage: medication.dosage,
        frequency: medication.frequency,
        reason: medication.reason,
        prescriberName: medication.prescriberName,
        startedOn: medication.startedOn,
        endedOn: medication.endedOn,
        notes: medication.notes,
        createdAt: medication.createdAt,
      },
      update: {
        name: medication.name,
        dosage: medication.dosage,
        frequency: medication.frequency,
        reason: medication.reason,
        prescriberName: medication.prescriberName,
        startedOn: medication.startedOn,
        endedOn: medication.endedOn,
        notes: medication.notes,
      },
    });
  }

  async delete(id: string): Promise<void> {
    await this.prisma.medication.delete({ where: { id } });
  }
}
