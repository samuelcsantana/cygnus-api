import { BabyRepository } from '../baby/baby-repository';
import { BabyGuardianRepository } from '../baby/baby-guardian-repository';
import { ensureBabyAccess } from '../baby/ensure-baby-access';
import { Medication } from '../../domain/medication/medication';
import { MedicationRepository } from './medication-repository';
import { MedicationNotFoundError } from './errors/medication-not-found.error';

export interface UpdateMedicationInput {
  babyId: string;
  medicationId: string;
  requestingUserId: string;
  name?: string;
  startedOn?: Date;
  dosage?: string | null;
  frequency?: string | null;
  reason?: string | null;
  prescriberName?: string | null;
  endedOn?: Date | null;
  notes?: string | null;
}

export class UpdateMedicationUseCase {
  constructor(
    private readonly babyRepository: BabyRepository,
    private readonly babyGuardianRepository: BabyGuardianRepository,
    private readonly medicationRepository: MedicationRepository,
  ) {}

  async execute(input: UpdateMedicationInput): Promise<Medication> {
    await ensureBabyAccess(this.babyRepository, this.babyGuardianRepository, input.babyId, input.requestingUserId);

    const existing = await this.medicationRepository.findById(input.medicationId);

    // Not redundant with the access check above: knowing a medication id must not be enough to
    // reach that row through another baby the caller does happen to have access to.
    if (!existing || existing.babyId !== input.babyId) {
      throw new MedicationNotFoundError();
    }

    const updated = Medication.record({
      id: existing.id,
      babyId: existing.babyId,
      name: input.name ?? existing.name,
      startedOn: input.startedOn ?? existing.startedOn,
      dosage: input.dosage !== undefined ? input.dosage : existing.dosage,
      frequency: input.frequency !== undefined ? input.frequency : existing.frequency,
      reason: input.reason !== undefined ? input.reason : existing.reason,
      prescriberName: input.prescriberName !== undefined ? input.prescriberName : existing.prescriberName,
      // Ending a course is the most common edit this route will ever get, and it is a `PATCH` with
      // `endedOn` set. `null` (still going) and absent (leave it alone) stay distinct so that
      // correcting the dose does not silently reopen a course that had ended.
      endedOn: input.endedOn !== undefined ? input.endedOn : existing.endedOn,
      notes: input.notes !== undefined ? input.notes : existing.notes,
      createdAt: existing.createdAt,
    });

    await this.medicationRepository.save(updated);

    return updated;
  }
}
