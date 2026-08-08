import { BabyRepository } from '../baby/baby-repository';
import { BabyNotFoundError } from '../baby/errors/baby-not-found.error';
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
    private readonly babyVaccineRecordRepository: BabyVaccineRecordRepository,
  ) {}

  async execute(input: DeleteAdhocVaccineRecordInput): Promise<void> {
    const baby = await this.babyRepository.findById(input.babyId);

    if (!baby || baby.userId !== input.requestingUserId) {
      throw new BabyNotFoundError();
    }

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
