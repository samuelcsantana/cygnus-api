import { BabyRepository } from '../baby/baby-repository';
import { BabyGuardianRepository } from '../baby/baby-guardian-repository';
import { ensureBabyAccess } from '../baby/ensure-baby-access';
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
    private readonly babyGuardianRepository: BabyGuardianRepository,
    private readonly milestoneRepository: MilestoneRepository,
  ) {}

  async execute(input: GetMilestoneByIdInput): Promise<Milestone> {
    await ensureBabyAccess(this.babyRepository, this.babyGuardianRepository, input.babyId, input.requestingUserId);

    const milestone = await this.milestoneRepository.findById(input.milestoneId);

    if (!milestone || milestone.babyId !== input.babyId) {
      throw new MilestoneNotFoundError();
    }

    return milestone;
  }
}
