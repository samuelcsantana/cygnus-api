import { BabyRepository } from '../baby/baby-repository';
import { BabyNotFoundError } from '../baby/errors/baby-not-found.error';
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
    private readonly milestoneRepository: MilestoneRepository,
  ) {}

  async execute(input: DeleteMilestoneInput): Promise<void> {
    const baby = await this.babyRepository.findById(input.babyId);

    if (!baby || baby.userId !== input.requestingUserId) {
      throw new BabyNotFoundError();
    }

    const existingMilestone = await this.milestoneRepository.findById(input.milestoneId);

    if (!existingMilestone || existingMilestone.babyId !== input.babyId) {
      throw new MilestoneNotFoundError();
    }

    await this.milestoneRepository.delete(input.milestoneId);
  }
}
