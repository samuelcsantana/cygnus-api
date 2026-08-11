import { BabyRepository } from '../baby/baby-repository';
import { BabyGuardianRepository } from '../baby/baby-guardian-repository';
import { ensureBabyAccess } from '../baby/ensure-baby-access';
import { BabyVaccineRecordRepository } from './baby-vaccine-record-repository';
import { VaccineRecordNotFoundError } from './errors/vaccine-record-not-found.error';

export interface DeleteAdhocVaccineRecordInput {
  babyId: string;
  recordId: string;
  requestingUserId: string;
}

export class DeleteAdhocVaccineRecordUseCase {
  constructor(
    private readonly babyRepository: BabyRepository,
    private readonly babyGuardianRepository: BabyGuardianRepository,
    private readonly babyVaccineRecordRepository: BabyVaccineRecordRepository,
  ) {}

  async execute(input: DeleteAdhocVaccineRecordInput): Promise<void> {
    await ensureBabyAccess(this.babyRepository, this.babyGuardianRepository, input.babyId, input.requestingUserId);

    const existingRecord = await this.babyVaccineRecordRepository.findById(input.recordId);

    // Deliberately scoped to CAMPAIGN/CUSTOM records only: the CATALOG entries generated from the
    // official schedule are meant to be corrected (re-apply with new details), not deleted —
    // deleting one here would silently make official calendar tracking disappear.
    if (!existingRecord || existingRecord.babyId !== input.babyId || existingRecord.source === 'CATALOG') {
      throw new VaccineRecordNotFoundError();
    }

    await this.babyVaccineRecordRepository.delete(input.recordId);
  }
}
