import { randomUUID } from 'node:crypto';
import { BabyRepository } from '../baby/baby-repository';
import { BabyGuardianRepository } from '../baby/baby-guardian-repository';
import { ensureBabyAccess } from '../baby/ensure-baby-access';
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
    private readonly babyGuardianRepository: BabyGuardianRepository,
    private readonly babyVaccineRecordRepository: BabyVaccineRecordRepository,
  ) {}

  async execute(input: RegisterAdhocVaccineInput): Promise<BabyVaccineRecord> {
    await ensureBabyAccess(this.babyRepository, this.babyGuardianRepository, input.babyId, input.requestingUserId);

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
