import { BabyRepository } from '../baby/baby-repository';
import { BabyGuardianRepository } from '../baby/baby-guardian-repository';
import { ensureBabyAccess } from '../baby/ensure-baby-access';
import { BabyVaccineRecord, VaccineRecordStatus } from '../../domain/vaccine/baby-vaccine-record';
import { addMonthsClamped } from '../../shared/utils/date';
import { BabyVaccineRecordRepository } from './baby-vaccine-record-repository';
import { VaccineRepository } from './vaccine-repository';

export interface VaccineScheduleItem {
  vaccineId: string;
  name: string;
  description: string;
  doseNumber: number;
  recommendedAgeInMonths: number;
  status: VaccineRecordStatus;
  applicationDate: Date | null;
  notes: string | null;
  batchNumber: string | null;
  location: string | null;
  professional: string | null;
  photoUrl: string | null;
}

export interface AgeGroupSchedule {
  ageInMonths: number;
  items: VaccineScheduleItem[];
}

export interface GetBabyVaccineScheduleInput {
  babyId: string;
  requestingUserId: string;
  referenceDate?: Date;
}

export class GetBabyVaccineScheduleUseCase {
  constructor(
    private readonly babyRepository: BabyRepository,
    private readonly babyGuardianRepository: BabyGuardianRepository,
    private readonly vaccineRepository: VaccineRepository,
    private readonly babyVaccineRecordRepository: BabyVaccineRecordRepository,
  ) {}

  async execute(input: GetBabyVaccineScheduleInput): Promise<AgeGroupSchedule[]> {
    const baby = await ensureBabyAccess(
      this.babyRepository,
      this.babyGuardianRepository,
      input.babyId,
      input.requestingUserId,
    );

    const [vaccines, appliedRecords] = await Promise.all([
      this.vaccineRepository.findAll(),
      this.babyVaccineRecordRepository.findAllByBabyId(input.babyId),
    ]);

    const appliedByVaccineId = new Map(appliedRecords.map((record) => [record.vaccineId, record]));
    const referenceDate = input.referenceDate ?? new Date();

    const items: VaccineScheduleItem[] = vaccines.map((vaccine) => {
      const dueDate = addMonthsClamped(baby.birthDate, vaccine.recommendedAgeInMonths);
      const record: BabyVaccineRecord =
        appliedByVaccineId.get(vaccine.id) ??
        BabyVaccineRecord.derive({
          id: `${input.babyId}:${vaccine.id}`,
          babyId: input.babyId,
          vaccineId: vaccine.id,
          dueDate,
          referenceDate,
        });

      return {
        vaccineId: vaccine.id,
        name: vaccine.name,
        description: vaccine.description,
        doseNumber: vaccine.doseNumber,
        recommendedAgeInMonths: vaccine.recommendedAgeInMonths,
        status: record.status,
        applicationDate: record.applicationDate,
        notes: record.notes,
        batchNumber: record.batchNumber,
        location: record.location,
        professional: record.professional,
        photoUrl: record.photoUrl,
      };
    });

    const groupedByAge = new Map<number, VaccineScheduleItem[]>();

    for (const item of items) {
      const group = groupedByAge.get(item.recommendedAgeInMonths) ?? [];
      group.push(item);
      groupedByAge.set(item.recommendedAgeInMonths, group);
    }

    return [...groupedByAge.entries()]
      .sort(([a], [b]) => a - b)
      .map(([ageInMonths, groupItems]) => ({ ageInMonths, items: groupItems }));
  }
}
