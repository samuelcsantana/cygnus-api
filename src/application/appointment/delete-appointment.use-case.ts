import { BabyRepository } from '../baby/baby-repository';
import { BabyGuardianRepository } from '../baby/baby-guardian-repository';
import { ensureBabyAccess } from '../baby/ensure-baby-access';
import { AppointmentRepository } from './appointment-repository';
import { AppointmentNotFoundError } from './errors/appointment-not-found.error';

export interface DeleteAppointmentInput {
  babyId: string;
  appointmentId: string;
  requestingUserId: string;
}

/**
 * Removes an appointment for good.
 *
 * Distinct from cancelling, which is what this API offered until now: cancelling
 * is `PATCH status=CANCELLED` and keeps the row, because "the visit was called
 * off" is part of the history. Deleting is for the other case — the record
 * should not exist, usually because it was entered by mistake. Since #21 an
 * appointment can also be recorded after the fact, and cancelling something that
 * already happened says nothing at all.
 *
 * Hard delete, and no status is exempt. That mirrors milestones, which are just
 * as much a health record and have always been deletable: the data belongs to
 * the family, and a typo in a completed visit is exactly as wrong as a typo in a
 * scheduled one.
 */
export class DeleteAppointmentUseCase {
  constructor(
    private readonly babyRepository: BabyRepository,
    private readonly babyGuardianRepository: BabyGuardianRepository,
    private readonly appointmentRepository: AppointmentRepository,
  ) {}

  async execute(input: DeleteAppointmentInput): Promise<void> {
    await ensureBabyAccess(this.babyRepository, this.babyGuardianRepository, input.babyId, input.requestingUserId);

    const existingAppointment = await this.appointmentRepository.findById(input.appointmentId);

    // The babyId check is not redundant with the access check above: knowing an
    // appointment id must not be enough to delete it from under a baby the
    // caller does have access to.
    if (!existingAppointment || existingAppointment.babyId !== input.babyId) {
      throw new AppointmentNotFoundError();
    }

    await this.appointmentRepository.delete(input.appointmentId);
  }
}
