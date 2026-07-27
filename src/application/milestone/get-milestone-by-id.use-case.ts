import { BabyRepository } from '../baby/baby-repository';
import { BabyNotFoundError } from '../baby/errors/baby-not-found.error';
import { Milestone } from '../../domain/milestone/milestone';
import { MilestoneRepository } from './milestone-repository';
import { MilestoneNotFoundError } from './errors/milestone-not-found.error';

export interface GetMilestoneByIdInput {
  babyId: string;
  milestoneId: string;
  requestingUserId: string;
}

export class GetMilestoneByIdUseCase {
  constructor(
    private readonly babyRepository: BabyRepository,
    private readonly milestoneRepository: MilestoneRepository,
  ) {}

  async execute(input: GetMilestoneByIdInput): Promise<Milestone> {
    const baby = await this.babyRepository.findById(input.babyId);

    if (!baby || baby.userId !== input.requestingUserId) {
      throw new BabyNotFoundError();
    }

    const milestone = await this.milestoneRepository.findById(input.milestoneId);

    if (!milestone || milestone.babyId !== input.babyId) {
      throw new MilestoneNotFoundError();
    }

    return milestone;
  }
}
