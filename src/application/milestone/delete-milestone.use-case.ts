import { BabyRepository } from '../baby/baby-repository';
import { BabyGuardianRepository } from '../baby/baby-guardian-repository';
import { ensureBabyAccess } from '../baby/ensure-baby-access';
import { MilestoneRepository } from './milestone-repository';
import { MilestoneNotFoundError } from './errors/milestone-not-found.error';

export interface DeleteMilestoneInput {
  babyId: string;
  milestoneId: string;
  requestingUserId: string;
}

export class DeleteMilestoneUseCase {
  constructor(
    private readonly babyRepository: BabyRepository,
    private readonly babyGuardianRepository: BabyGuardianRepository,
    private readonly milestoneRepository: MilestoneRepository,
  ) {}

  async execute(input: DeleteMilestoneInput): Promise<void> {
    await ensureBabyAccess(this.babyRepository, this.babyGuardianRepository, input.babyId, input.requestingUserId);

    const existingMilestone = await this.milestoneRepository.findById(input.milestoneId);

    if (!existingMilestone || existingMilestone.babyId !== input.babyId) {
      throw new MilestoneNotFoundError();
    }

    await this.milestoneRepository.delete(input.milestoneId);
  }
}
