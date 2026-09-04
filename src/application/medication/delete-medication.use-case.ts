import { BabyRepository } from '../baby/baby-repository';
import { BabyGuardianRepository } from '../baby/baby-guardian-repository';
import { ensureBabyAccess } from '../baby/ensure-baby-access';
import { MedicationRepository } from './medication-repository';
import { MedicationNotFoundError } from './errors/medication-not-found.error';

export interface DeleteMedicationInput {
  babyId: string;
  medicationId: string;
  requestingUserId: string;
}

export class DeleteMedicationUseCase {
  constructor(
    private readonly babyRepository: BabyRepository,
    private readonly babyGuardianRepository: BabyGuardianRepository,
    private readonly medicationRepository: MedicationRepository,
  ) {}

  async execute(input: DeleteMedicationInput): Promise<void> {
    await ensureBabyAccess(this.babyRepository, this.babyGuardianRepository, input.babyId, input.requestingUserId);

    const existing = await this.medicationRepository.findById(input.medicationId);

    if (!existing || existing.babyId !== input.babyId) {
      throw new MedicationNotFoundError();
    }

    await this.medicationRepository.delete(input.medicationId);
  }
}
