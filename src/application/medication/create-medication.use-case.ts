import { randomUUID } from 'node:crypto';
import { BabyRepository } from '../baby/baby-repository';
import { BabyGuardianRepository } from '../baby/baby-guardian-repository';
import { ensureBabyAccess } from '../baby/ensure-baby-access';
import { Medication } from '../../domain/medication/medication';
import { MedicationRepository } from './medication-repository';

export interface CreateMedicationInput {
  babyId: string;
  requestingUserId: string;
  name: string;
  startedOn: Date;
  dosage?: string | null;
  frequency?: string | null;
  reason?: string | null;
  prescriberName?: string | null;
  endedOn?: Date | null;
  notes?: string | null;
}

export class CreateMedicationUseCase {
  constructor(
    private readonly babyRepository: BabyRepository,
    private readonly babyGuardianRepository: BabyGuardianRepository,
    private readonly medicationRepository: MedicationRepository,
  ) {}

  async execute(input: CreateMedicationInput): Promise<Medication> {
    await ensureBabyAccess(this.babyRepository, this.babyGuardianRepository, input.babyId, input.requestingUserId);

    const medication = Medication.record({
      id: randomUUID(),
      babyId: input.babyId,
      name: input.name,
      startedOn: input.startedOn,
      dosage: input.dosage,
      frequency: input.frequency,
      reason: input.reason,
      prescriberName: input.prescriberName,
      endedOn: input.endedOn,
      notes: input.notes,
    });

    await this.medicationRepository.save(medication);

    return medication;
  }
}
