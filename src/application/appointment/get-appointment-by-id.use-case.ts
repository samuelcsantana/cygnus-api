import { BabyRepository } from '../baby/baby-repository';
import { BabyGuardianRepository } from '../baby/baby-guardian-repository';
import { ensureBabyAccess } from '../baby/ensure-baby-access';
import { Appointment } from '../../domain/appointment/appointment';
import { AppointmentRepository } from './appointment-repository';
import { AppointmentNotFoundError } from './errors/appointment-not-found.error';

export interface GetAppointmentByIdInput {
  babyId: string;
  appointmentId: string;
  requestingUserId: string;
}

export class GetAppointmentByIdUseCase {
  constructor(
    private readonly babyRepository: BabyRepository,
    private readonly babyGuardianRepository: BabyGuardianRepository,
    private readonly appointmentRepository: AppointmentRepository,
  ) {}

  async execute(input: GetAppointmentByIdInput): Promise<Appointment> {
    await ensureBabyAccess(this.babyRepository, this.babyGuardianRepository, input.babyId, input.requestingUserId);

    const appointment = await this.appointmentRepository.findById(input.appointmentId);

    if (!appointment || appointment.babyId !== input.babyId) {
      throw new AppointmentNotFoundError();
    }

    return appointment;
  }
}
