import { randomUUID } from 'node:crypto';
import { BabyRepository } from '../baby/baby-repository';
import { BabyGuardianRepository } from '../baby/baby-guardian-repository';
import { ensureBabyAccess } from '../baby/ensure-baby-access';
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
  batchNumber?: string | null;
  location?: string | null;
  professional?: string | null;
  photoUrl?: string | null;
}

export class MarkVaccineAsAppliedUseCase {
  constructor(
    private readonly babyRepository: BabyRepository,
    private readonly babyGuardianRepository: BabyGuardianRepository,
    private readonly vaccineRepository: VaccineRepository,
    private readonly babyVaccineRecordRepository: BabyVaccineRecordRepository,
  ) {}

  async execute(input: MarkVaccineAsAppliedInput): Promise<BabyVaccineRecord> {
    await ensureBabyAccess(this.babyRepository, this.babyGuardianRepository, input.babyId, input.requestingUserId);

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
      batchNumber: input.batchNumber,
      location: input.location,
      professional: input.professional,
      photoUrl: input.photoUrl,
    });

    await this.babyVaccineRecordRepository.save(record);

    return record;
  }
}
