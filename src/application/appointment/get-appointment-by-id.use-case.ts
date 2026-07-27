import { BabyRepository } from '../baby/baby-repository';
import { BabyNotFoundError } from '../baby/errors/baby-not-found.error';
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
    private readonly appointmentRepository: AppointmentRepository,
  ) {}

  async execute(input: GetAppointmentByIdInput): Promise<Appointment> {
    const baby = await this.babyRepository.findById(input.babyId);

    if (!baby || baby.userId !== input.requestingUserId) {
      throw new BabyNotFoundError();
    }

    const appointment = await this.appointmentRepository.findById(input.appointmentId);

    if (!appointment || appointment.babyId !== input.babyId) {
      throw new AppointmentNotFoundError();
    }

    return appointment;
  }
}
