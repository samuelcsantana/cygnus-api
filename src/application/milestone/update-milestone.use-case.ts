import { BabyRepository } from '../baby/baby-repository';
import { BabyGuardianRepository } from '../baby/baby-guardian-repository';
import { ensureBabyAccess } from '../baby/ensure-baby-access';
import { Milestone, MilestoneCategory } from '../../domain/milestone/milestone';
import { InvalidMilestoneTitleError } from '../../domain/milestone/errors/invalid-milestone-title.error';
import { MilestoneRepository } from './milestone-repository';
import { MilestoneNotFoundError } from './errors/milestone-not-found.error';

export interface UpdateMilestoneInput {
  babyId: string;
  milestoneId: string;
  requestingUserId: string;
  title?: string;
  description?: string | null;
  achievedAt?: Date;
  category?: MilestoneCategory;
  photoUrl?: string | null;
  referenceDate?: Date;
}

function normalizeTitle(title: string): string {
  const trimmed = title.trim();

  if (trimmed.length === 0) {
    throw new InvalidMilestoneTitleError();
  }

  return trimmed;
}

export class UpdateMilestoneUseCase {
  constructor(
    private readonly babyRepository: BabyRepository,
    private readonly babyGuardianRepository: BabyGuardianRepository,
    private readonly milestoneRepository: MilestoneRepository,
  ) {}

  async execute(input: UpdateMilestoneInput): Promise<Milestone> {
    const baby = await ensureBabyAccess(
      this.babyRepository,
      this.babyGuardianRepository,
      input.babyId,
      input.requestingUserId,
    );

    const existingMilestone = await this.milestoneRepository.findById(input.milestoneId);

    if (!existingMilestone || existingMilestone.babyId !== input.babyId) {
      throw new MilestoneNotFoundError();
    }

    if (input.achievedAt) {
      Milestone.assertAchievedAtIsValid(input.achievedAt, baby.birthDate, input.referenceDate);
    }

    const updatedMilestone = Milestone.restore({
      id: existingMilestone.id,
      babyId: existingMilestone.babyId,
      title: input.title ? normalizeTitle(input.title) : existingMilestone.title,
      description: input.description !== undefined ? input.description : existingMilestone.description,
      achievedAt: input.achievedAt ?? existingMilestone.achievedAt,
      category: input.category ?? existingMilestone.category,
      photoUrl: input.photoUrl !== undefined ? input.photoUrl : existingMilestone.photoUrl,
      createdAt: existingMilestone.createdAt,
    });

    await this.milestoneRepository.save(updatedMilestone);

    return updatedMilestone;
  }
}
