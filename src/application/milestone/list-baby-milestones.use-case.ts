import { BabyRepository } from '../baby/baby-repository';
import { BabyGuardianRepository } from '../baby/baby-guardian-repository';
import { ensureBabyAccess } from '../baby/ensure-baby-access';
import { Milestone } from '../../domain/milestone/milestone';
import { MilestoneRepository } from './milestone-repository';

export interface ListBabyMilestonesInput {
  babyId: string;
  requestingUserId: string;
  search?: string;
}

export class ListBabyMilestonesUseCase {
  constructor(
    private readonly babyRepository: BabyRepository,
    private readonly babyGuardianRepository: BabyGuardianRepository,
    private readonly milestoneRepository: MilestoneRepository,
  ) {}

  async execute(input: ListBabyMilestonesInput): Promise<Milestone[]> {
    await ensureBabyAccess(this.babyRepository, this.babyGuardianRepository, input.babyId, input.requestingUserId);

    return this.milestoneRepository.findAllByBabyId(input.babyId, input.search);
  }
}
