import { BabyRepository } from '../baby/baby-repository';
import { BabyNotFoundError } from '../baby/errors/baby-not-found.error';
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
    private readonly vaccineRepository: VaccineRepository,
    private readonly babyVaccineRecordRepository: BabyVaccineRecordRepository,
  ) {}

  async execute(input: GetBabyVaccineScheduleInput): Promise<AgeGroupSchedule[]> {
    const baby = await this.babyRepository.findById(input.babyId);

    if (!baby || baby.userId !== input.requestingUserId) {
      throw new BabyNotFoundError();
    }

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
