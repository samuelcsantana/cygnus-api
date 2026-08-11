import { BabyRepository } from './baby-repository';
import { BabyGuardianRepository } from './baby-guardian-repository';
import { ensureBabyAccess } from './ensure-baby-access';
import { GuardianForbiddenError } from './errors/guardian-forbidden.error';

export interface DeleteBabyInput {
  babyId: string;
  requestingUserId: string;
}

export class DeleteBabyUseCase {
  constructor(
    private readonly babyRepository: BabyRepository,
    private readonly babyGuardianRepository: BabyGuardianRepository,
  ) {}

  async execute(input: DeleteBabyInput): Promise<void> {
    await ensureBabyAccess(this.babyRepository, this.babyGuardianRepository, input.babyId, input.requestingUserId);

    // Deleting the whole profile is OWNER-only — a shared GUARDIAN can read/write health data but
    // shouldn't be able to wipe another guardian's (or the creator's) child's profile.
    const guardian = await this.babyGuardianRepository.findByBabyAndUser(input.babyId, input.requestingUserId);

    if (!guardian?.isOwner()) {
      throw new GuardianForbiddenError('Only the baby profile owner can delete it');
    }

    await this.babyRepository.delete(input.babyId);
  }
}
