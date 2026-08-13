import { BabyRepository } from '../baby/baby-repository';
import { BabyGuardianRepository } from '../baby/baby-guardian-repository';
import { ensureBabyAccess } from '../baby/ensure-baby-access';
import { BabyVaccineRecord, VaccineRecordStatus } from '../../domain/vaccine/baby-vaccine-record';
import { VaccineRecommendationKind } from '../../domain/vaccine/vaccine';
import { ACTIVE_VACCINE_CATALOG } from '../../shared/config/vaccine-catalog';
import { addMonthsClamped } from '../../shared/utils/date';
import { BabyVaccineRecordRepository } from './baby-vaccine-record-repository';
import { VaccineRepository } from './vaccine-repository';

export interface VaccineScheduleItem {
  vaccineId: string;
  name: string;
  description: string;
  guidance: string | null;
  doseNumber: number;
  recommendedAgeInMonths: number;
  recommendationKind: VaccineRecommendationKind;
  status: VaccineScheduleStatus;
  applicationDate: Date | null;
  notes: string | null;
  batchNumber: string | null;
  location: string | null;
  professional: string | null;
  photoUrl: string | null;
}

export type VaccineScheduleStatus = VaccineRecordStatus | 'GUIDANCE';

export interface AgeGroupSchedule {
  ageInMonths: number;
  items: VaccineScheduleItem[];
}

export interface VaccineSchedule {
  metadata: {
    version: string;
    sourceName: string;
    sourceOrganization: string;
    sourceUrl: string;
    sourceUpdatedAt: string;
    effectiveFrom: string;
    minimumAgeInMonths: number;
    maximumAgeInMonths: number;
  };
  groups: AgeGroupSchedule[];
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

  async execute(input: GetBabyVaccineScheduleInput): Promise<VaccineSchedule> {
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

    const appliedByVaccineId = new Map<string, BabyVaccineRecord>();
    for (const record of appliedRecords) {
      if (record.vaccineId) {
        appliedByVaccineId.set(record.vaccineId, record);
      }
    }
    const referenceDate = input.referenceDate ?? new Date();

    const items: VaccineScheduleItem[] = vaccines.map((vaccine) => {
      const dueDate = addMonthsClamped(baby.birthDate, vaccine.recommendedAgeInMonths);
      const appliedRecord = appliedByVaccineId.get(vaccine.id);
      const isCoveredByCurrentVersion = dueDate.getTime() >= vaccine.effectiveFrom.getTime();
      const derivedRecord: BabyVaccineRecord | null =
        !appliedRecord && vaccine.recommendationKind === 'ROUTINE' && isCoveredByCurrentVersion
          ? BabyVaccineRecord.derive({
              id: `${input.babyId}:${vaccine.id}`,
              babyId: input.babyId,
              vaccineId: vaccine.id,
              dueDate,
              referenceDate,
            })
          : null;
      const record = appliedRecord ?? derivedRecord;

      return {
        vaccineId: vaccine.id,
        name: vaccine.name,
        description: vaccine.description,
        guidance: vaccine.guidance,
        doseNumber: vaccine.doseNumber,
        recommendedAgeInMonths: vaccine.recommendedAgeInMonths,
        recommendationKind: vaccine.recommendationKind,
        status: record?.status ?? 'GUIDANCE',
        applicationDate: record?.applicationDate ?? null,
        notes: record?.notes ?? null,
        batchNumber: record?.batchNumber ?? null,
        location: record?.location ?? null,
        professional: record?.professional ?? null,
        photoUrl: record?.photoUrl ?? null,
      };
    });

    const groupedByAge = new Map<number, VaccineScheduleItem[]>();

    for (const item of items) {
      const group = groupedByAge.get(item.recommendedAgeInMonths) ?? [];
      group.push(item);
      groupedByAge.set(item.recommendedAgeInMonths, group);
    }

    const groups = [...groupedByAge.entries()]
      .sort(([a], [b]) => a - b)
      .map(([ageInMonths, groupItems]) => ({ ageInMonths, items: groupItems }));

    return { metadata: { ...ACTIVE_VACCINE_CATALOG }, groups };
  }
}
