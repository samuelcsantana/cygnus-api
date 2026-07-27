import { randomUUID } from 'node:crypto';
import { BabyRepository } from '../baby/baby-repository';
import { BabyNotFoundError } from '../baby/errors/baby-not-found.error';
import { BabyVaccineRecord } from '../../domain/vaccine/baby-vaccine-record';
import { BabyVaccineRecordRepository } from './baby-vaccine-record-repository';
import { VaccineRepository } from './vaccine-repository';
import { VaccineNotFoundError } from './errors/vaccine-not-found.error';

export interface MarkVaccineAsAppliedInput {
  babyId: string;
  vaccineId: string;
  requestingUserId: string;
  applicationDate?: Date;
  notes?: string | null;
}

export class MarkVaccineAsAppliedUseCase {
  constructor(
    private readonly babyRepository: BabyRepository,
    private readonly vaccineRepository: VaccineRepository,
    private readonly babyVaccineRecordRepository: BabyVaccineRecordRepository,
  ) {}

  async execute(input: MarkVaccineAsAppliedInput): Promise<BabyVaccineRecord> {
    const baby = await this.babyRepository.findById(input.babyId);

    if (!baby || baby.userId !== input.requestingUserId) {
      throw new BabyNotFoundError();
    }

    const vaccine = await this.vaccineRepository.findById(input.vaccineId);

    if (!vaccine) {
      throw new VaccineNotFoundError();
    }

    const existingRecord = await this.babyVaccineRecordRepository.findByBabyAndVaccine(
      input.babyId,
      input.vaccineId,
    );

    const record = BabyVaccineRecord.markApplied({
      id: existingRecord?.id ?? randomUUID(),
      babyId: input.babyId,
      vaccineId: input.vaccineId,
      applicationDate: input.applicationDate ?? new Date(),
      notes: input.notes,
    });

    await this.babyVaccineRecordRepository.save(record);

    return record;
  }
}
