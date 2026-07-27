import { randomUUID } from 'node:crypto';
import { BabyRepository } from '../baby/baby-repository';
import { BabyNotFoundError } from '../baby/errors/baby-not-found.error';
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
    private readonly milestoneRepository: MilestoneRepository,
  ) {}

  async execute(input: CreateMilestoneInput): Promise<Milestone> {
    const baby = await this.babyRepository.findById(input.babyId);

    if (!baby || baby.userId !== input.requestingUserId) {
      throw new BabyNotFoundError();
    }

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
