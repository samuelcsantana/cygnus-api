import { BabyRepository } from '../baby/baby-repository';
import { BabyNotFoundError } from '../baby/errors/baby-not-found.error';
import { BabyVaccineRecord } from '../../domain/vaccine/baby-vaccine-record';
import { BabyVaccineRecordRepository } from './baby-vaccine-record-repository';

export interface ListAdhocVaccineRecordsInput {
  babyId: string;
  requestingUserId: string;
}

export class ListAdhocVaccineRecordsUseCase {
  constructor(
    private readonly babyRepository: BabyRepository,
    private readonly babyVaccineRecordRepository: BabyVaccineRecordRepository,
  ) {}

  async execute(input: ListAdhocVaccineRecordsInput): Promise<BabyVaccineRecord[]> {
    const baby = await this.babyRepository.findById(input.babyId);

    if (!baby || baby.userId !== input.requestingUserId) {
      throw new BabyNotFoundError();
    }

    const records = await this.babyVaccineRecordRepository.findAllByBabyId(input.babyId);

    return records
      .filter((record) => record.source !== 'CATALOG')
      .sort((a, b) => (b.applicationDate?.getTime() ?? 0) - (a.applicationDate?.getTime() ?? 0));
  }
}
