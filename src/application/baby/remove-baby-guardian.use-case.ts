import { BabyRepository } from './baby-repository';
import { BabyGuardianRepository } from './baby-guardian-repository';
import { ensureBabyAccess } from './ensure-baby-access';
import { GuardianNotFoundError } from './errors/guardian-not-found.error';
import { CannotRemoveOwnerError } from './errors/cannot-remove-owner.error';
import { GuardianForbiddenError } from './errors/guardian-forbidden.error';

export interface RemoveBabyGuardianInput {
  babyId: string;
  targetUserId: string;
  requestingUserId: string;
}

export class RemoveBabyGuardianUseCase {
  constructor(
    private readonly babyRepository: BabyRepository,
    private readonly babyGuardianRepository: BabyGuardianRepository,
  ) {}

  async execute(input: RemoveBabyGuardianInput): Promise<void> {
    await ensureBabyAccess(this.babyRepository, this.babyGuardianRepository, input.babyId, input.requestingUserId);

    const requesterGuardian = await this.babyGuardianRepository.findByBabyAndUser(
      input.babyId,
      input.requestingUserId,
    );
    const targetGuardian = await this.babyGuardianRepository.findByBabyAndUser(input.babyId, input.targetUserId);

    if (!targetGuardian) {
      throw new GuardianNotFoundError();
    }

    if (targetGuardian.role !== 'GUARDIAN') {
      throw new CannotRemoveOwnerError();
    }

    const isSelfRemoval = input.requestingUserId === input.targetUserId;
    const requesterIsOwner = requesterGuardian?.isOwner() ?? false;

    if (!isSelfRemoval && !requesterIsOwner) {
      throw new GuardianForbiddenError('Only the baby profile owner can remove another guardian');
    }

    await this.babyGuardianRepository.delete(input.babyId, input.targetUserId);
  }
}
