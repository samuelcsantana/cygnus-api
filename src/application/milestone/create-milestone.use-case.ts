import { randomUUID } from 'node:crypto';
import { BabyRepository } from '../baby/baby-repository';
import { BabyGuardianRepository } from '../baby/baby-guardian-repository';
import { ensureBabyAccess } from '../baby/ensure-baby-access';
import { Milestone, MilestoneCategory } from '../../domain/milestone/milestone';
import { MilestoneRepository } from './milestone-repository';

export interface CreateMilestoneInput {
  babyId: string;
  requestingUserId: string;
  title: string;
  achievedAt: Date;
  category: MilestoneCategory;
  description?: string | null;
  photoUrl?: string | null;
  referenceDate?: Date;
}

export class CreateMilestoneUseCase {
  constructor(
    private readonly babyRepository: BabyRepository,
    private readonly babyGuardianRepository: BabyGuardianRepository,
    private readonly milestoneRepository: MilestoneRepository,
  ) {}

  async execute(input: CreateMilestoneInput): Promise<Milestone> {
    const baby = await ensureBabyAccess(
      this.babyRepository,
      this.babyGuardianRepository,
      input.babyId,
      input.requestingUserId,
    );

    const milestone = Milestone.record({
      id: randomUUID(),
      babyId: input.babyId,
      title: input.title,
      achievedAt: input.achievedAt,
      category: input.category,
      description: input.description,
      photoUrl: input.photoUrl,
      babyBirthDate: baby.birthDate,
      referenceDate: input.referenceDate,
    });

    await this.milestoneRepository.save(milestone);

    return milestone;
  }
}
