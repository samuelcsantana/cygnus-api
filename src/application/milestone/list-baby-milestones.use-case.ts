import { BabyRepository } from '../baby/baby-repository';
import { BabyNotFoundError } from '../baby/errors/baby-not-found.error';
import { Milestone } from '../../domain/milestone/milestone';
import { MilestoneRepository } from './milestone-repository';

export interface ListBabyMilestonesInput {
  babyId: string;
  requestingUserId: string;
}

export class ListBabyMilestonesUseCase {
  constructor(
    private readonly babyRepository: BabyRepository,
    private readonly milestoneRepository: MilestoneRepository,
  ) {}

  async execute(input: ListBabyMilestonesInput): Promise<Milestone[]> {
    const baby = await this.babyRepository.findById(input.babyId);

    if (!baby || baby.userId !== input.requestingUserId) {
      throw new BabyNotFoundError();
    }

    return this.milestoneRepository.findAllByBabyId(input.babyId);
  }
}
