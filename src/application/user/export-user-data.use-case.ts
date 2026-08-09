import { UserRepository } from './user-repository';
import { UserNotFoundError } from './errors/user-not-found.error';
import { BabyRepository } from '../baby/baby-repository';
import { Baby } from '../../domain/baby/baby';
import { BabyVaccineRecordRepository } from '../vaccine/baby-vaccine-record-repository';
import { BabyVaccineRecord } from '../../domain/vaccine/baby-vaccine-record';
import { AppointmentRepository } from '../appointment/appointment-repository';
import { Appointment } from '../../domain/appointment/appointment';
import { MilestoneRepository } from '../milestone/milestone-repository';
import { Milestone } from '../../domain/milestone/milestone';

export interface ExportUserDataInput {
  userId: string;
}

export interface ExportedBaby {
  baby: Baby;
  vaccineRecords: BabyVaccineRecord[];
  appointments: Appointment[];
  milestones: Milestone[];
}

export interface ExportedUserData {
  user: { id: string; email: string; name: string; createdAt: Date };
  babies: ExportedBaby[];
}

// Powers the LGPD "right to data portability" export (GET /users/me/export) — composes the
// existing per-feature repositories rather than adding a bespoke query, so it stays consistent
// with whatever each feature considers "this baby's data" (e.g. vaccine records include both
// catalog and adhoc entries, matching what /babies/:babyId/vaccines/adhoc already exposes).
export class ExportUserDataUseCase {
  constructor(
    private readonly userRepository: UserRepository,
    private readonly babyRepository: BabyRepository,
    private readonly babyVaccineRecordRepository: BabyVaccineRecordRepository,
    private readonly appointmentRepository: AppointmentRepository,
    private readonly milestoneRepository: MilestoneRepository,
  ) {}

  async execute(input: ExportUserDataInput): Promise<ExportedUserData> {
    const user = await this.userRepository.findById(input.userId);

    if (!user) {
      throw new UserNotFoundError();
    }

    const babies = await this.babyRepository.findAllByUserId(input.userId);

    const exportedBabies = await Promise.all(
      babies.map(async (baby): Promise<ExportedBaby> => {
        const [vaccineRecords, appointments, milestones] = await Promise.all([
          this.babyVaccineRecordRepository.findAllByBabyId(baby.id),
          this.appointmentRepository.findAllByBabyId(baby.id),
          this.milestoneRepository.findAllByBabyId(baby.id),
        ]);

        return { baby, vaccineRecords, appointments, milestones };
      }),
    );

    return {
      user: { id: user.id, email: user.email, name: user.name, createdAt: user.createdAt },
      babies: exportedBabies,
    };
  }
}
