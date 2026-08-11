import { BabyRepository } from '../baby/baby-repository';
import { BabyGuardianRepository } from '../baby/baby-guardian-repository';
import { ensureBabyAccess } from '../baby/ensure-baby-access';
import { BabyVaccineRecord } from '../../domain/vaccine/baby-vaccine-record';
import { BabyVaccineRecordRepository } from './baby-vaccine-record-repository';

export interface ListAdhocVaccineRecordsInput {
  babyId: string;
  requestingUserId: string;
  search?: string;
}

export class ListAdhocVaccineRecordsUseCase {
  constructor(
    private readonly babyRepository: BabyRepository,
    private readonly babyGuardianRepository: BabyGuardianRepository,
    private readonly babyVaccineRecordRepository: BabyVaccineRecordRepository,
  ) {}

  async execute(input: ListAdhocVaccineRecordsInput): Promise<BabyVaccineRecord[]> {
    await ensureBabyAccess(this.babyRepository, this.babyGuardianRepository, input.babyId, input.requestingUserId);

    const records = await this.babyVaccineRecordRepository.findAllByBabyId(input.babyId, input.search);

    return records
      .filter((record) => record.source !== 'CATALOG')
      .sort((a, b) => (b.applicationDate?.getTime() ?? 0) - (a.applicationDate?.getTime() ?? 0));
  }
}
