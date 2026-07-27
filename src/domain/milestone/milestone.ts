import { startOfUtcDay } from '../../shared/utils/date';
import { FutureMilestoneDateError } from './errors/future-milestone-date.error';
import { InvalidMilestoneTitleError } from './errors/invalid-milestone-title.error';
import { MilestoneBeforeBirthError } from './errors/milestone-before-birth.error';

export type MilestoneCategory = 'MOTOR' | 'LANGUAGE' | 'SOCIAL' | 'COGNITIVE' | 'OTHER';

export interface MilestoneProps {
  id: string;
  babyId: string;
  title: string;
  description: string | null;
  achievedAt: Date;
  category: MilestoneCategory;
  photoUrl: string | null;
  createdAt: Date;
}

export interface RecordMilestoneProps {
  id: string;
  babyId: string;
  title: string;
  achievedAt: Date;
  category: MilestoneCategory;
  babyBirthDate: Date;
  description?: string | null;
  photoUrl?: string | null;
  createdAt?: Date;
  referenceDate?: Date;
}

export class Milestone {
  readonly id: string;
  readonly babyId: string;
  readonly title: string;
  readonly description: string | null;
  readonly achievedAt: Date;
  readonly category: MilestoneCategory;
  readonly photoUrl: string | null;
  readonly createdAt: Date;

  private constructor(props: MilestoneProps) {
    this.id = props.id;
    this.babyId = props.babyId;
    this.title = props.title;
    this.description = props.description;
    this.achievedAt = props.achievedAt;
    this.category = props.category;
    this.photoUrl = props.photoUrl;
    this.createdAt = props.createdAt;
  }

  // Only enforced here (creation/explicit date change), never on plain reconstruction.
  static assertAchievedAtIsValid(achievedAt: Date, babyBirthDate: Date, referenceDate: Date = new Date()): void {
    const day = startOfUtcDay(achievedAt).getTime();

    if (day > startOfUtcDay(referenceDate).getTime()) {
      throw new FutureMilestoneDateError();
    }

    if (day < startOfUtcDay(babyBirthDate).getTime()) {
      throw new MilestoneBeforeBirthError();
    }
  }

  static record(props: RecordMilestoneProps): Milestone {
    const title = props.title.trim();

    if (title.length === 0) {
      throw new InvalidMilestoneTitleError();
    }

    Milestone.assertAchievedAtIsValid(props.achievedAt, props.babyBirthDate, props.referenceDate);

    return new Milestone({
      id: props.id,
      babyId: props.babyId,
      title,
      description: props.description ?? null,
      achievedAt: props.achievedAt,
      category: props.category,
      photoUrl: props.photoUrl ?? null,
      createdAt: props.createdAt ?? new Date(),
    });
  }

  static restore(props: MilestoneProps): Milestone {
    return new Milestone(props);
  }
}
