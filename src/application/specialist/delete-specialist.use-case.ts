import { SpecialistRepository } from './specialist-repository';
import { SpecialistNotFoundError } from './errors/specialist-not-found.error';

export interface DeleteSpecialistInput {
  specialistId: string;
  requestingUserId: string;
}

/**
 * Removing a professional edits the address book and nothing else.
 *
 * Appointments they attended keep their `doctorName` — the name as written on the day — and only
 * lose the `specialistId` link, which the schema nulls. A health record must not lose information
 * because somebody tidied a list.
 *
 * Owner only, and 404 rather than 403 for the same reason as editing: seeing an entry does not make
 * it yours to remove from somebody else's list.
 */
export class DeleteSpecialistUseCase {
  constructor(private readonly specialistRepository: SpecialistRepository) {}

  async execute(input: DeleteSpecialistInput): Promise<void> {
    const existing = await this.specialistRepository.findById(input.specialistId);

    if (!existing || existing.userId !== input.requestingUserId) {
      throw new SpecialistNotFoundError();
    }

    await this.specialistRepository.delete(input.specialistId);
  }
}
