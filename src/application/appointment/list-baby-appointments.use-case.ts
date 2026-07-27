import { BabyRepository } from '../baby/baby-repository';
import { BabyNotFoundError } from '../baby/errors/baby-not-found.error';
import { Appointment } from '../../domain/appointment/appointment';
import { AppointmentRepository } from './appointment-repository';

export interface ListBabyAppointmentsInput {
  babyId: string;
  requestingUserId: string;
}

export class ListBabyAppointmentsUseCase {
  constructor(
    private readonly babyRepository: BabyRepository,
    private readonly appointmentRepository: AppointmentRepository,
  ) {}

  async execute(input: ListBabyAppointmentsInput): Promise<Appointment[]> {
    const baby = await this.babyRepository.findById(input.babyId);

    if (!baby || baby.userId !== input.requestingUserId) {
      throw new BabyNotFoundError();
    }

    return this.appointmentRepository.findAllByBabyId(input.babyId);
  }
}
