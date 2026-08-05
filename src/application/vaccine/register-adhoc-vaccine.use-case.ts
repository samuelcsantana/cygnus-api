import { randomUUID } from 'node:crypto';
import { BabyRepository } from '../baby/baby-repository';
import { BabyNotFoundError } from '../baby/errors/baby-not-found.error';
import { BabyVaccineRecord, VaccineRecordSource } from '../../domain/vaccine/baby-vaccine-record';
import { BabyVaccineRecordRepository } from './baby-vaccine-record-repository';

export interface RegisterAdhocVaccineInput {
  babyId: string;
  requestingUserId: string;
  source: Exclude<VaccineRecordSource, 'CATALOG'>;
  customName: string;
  customDose?: string | null;
  applicationDate: Date;
  notes?: string | null;
  batchNumber?: string | null;
  location?: string | null;
  professional?: string | null;
  photoUrl?: string | null;
}

export class RegisterAdhocVaccineUseCase {
  constructor(
    private readonly babyRepository: BabyRepository,
    private readonly babyVaccineRecordRepository: BabyVaccineRecordRepository,
  ) {}

  async execute(input: RegisterAdhocVaccineInput): Promise<BabyVaccineRecord> {
    const baby = await this.babyRepository.findById(input.babyId);

    if (!baby || baby.userId !== input.requestingUserId) {
      throw new BabyNotFoundError();
    }

    const record = BabyVaccineRecord.registerAdhoc({
      id: randomUUID(),
      babyId: input.babyId,
      source: input.source,
      customName: input.customName,
      customDose: input.customDose,
      applicationDate: input.applicationDate,
      notes: input.notes,
      batchNumber: input.batchNumber,
      location: input.location,
      professional: input.professional,
      photoUrl: input.photoUrl,
    });

    await this.babyVaccineRecordRepository.create(record);

    return record;
  }
}
