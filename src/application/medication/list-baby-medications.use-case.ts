import { BabyRepository } from '../baby/baby-repository';
import { BabyGuardianRepository } from '../baby/baby-guardian-repository';
import { ensureBabyAccess } from '../baby/ensure-baby-access';
import { Medication } from '../../domain/medication/medication';
import { MedicationRepository } from './medication-repository';

export interface ListBabyMedicationsInput {
  babyId: string;
  requestingUserId: string;
}

export class ListBabyMedicationsUseCase {
  constructor(
    private readonly babyRepository: BabyRepository,
    private readonly babyGuardianRepository: BabyGuardianRepository,
    private readonly medicationRepository: MedicationRepository,
  ) {}

  async execute(input: ListBabyMedicationsInput): Promise<Medication[]> {
    await ensureBabyAccess(this.babyRepository, this.babyGuardianRepository, input.babyId, input.requestingUserId);

    return this.medicationRepository.findAllByBabyId(input.babyId);
  }
}
