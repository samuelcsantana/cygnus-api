import { BabyRepository } from '../baby/baby-repository';
import { BabyGuardianRepository } from '../baby/baby-guardian-repository';
import { ensureBabyAccess } from '../baby/ensure-baby-access';
import { SpecialistRepository } from './specialist-repository';
import { SpecialistNotFoundError } from './errors/specialist-not-found.error';

export interface DeleteSpecialistInput {
  babyId: string;
  specialistId: string;
  requestingUserId: string;
}

/**
 * Removing a specialist edits the address book and nothing else.
 *
 * Appointments they attended keep their `doctorName` — the name as it was written on the day — and
 * only lose the `specialistId` link, which the schema nulls (`ON DELETE SET NULL`). A health record
 * must not lose information because somebody tidied a list.
 */
export class DeleteSpecialistUseCase {
  constructor(
    private readonly babyRepository: BabyRepository,
    private readonly babyGuardianRepository: BabyGuardianRepository,
    private readonly specialistRepository: SpecialistRepository,
  ) {}

  async execute(input: DeleteSpecialistInput): Promise<void> {
    await ensureBabyAccess(this.babyRepository, this.babyGuardianRepository, input.babyId, input.requestingUserId);

    const existing = await this.specialistRepository.findById(input.specialistId);

    if (!existing || existing.babyId !== input.babyId) {
      throw new SpecialistNotFoundError();
    }

    await this.specialistRepository.delete(input.specialistId);
  }
}
