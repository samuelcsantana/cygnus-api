import { BabyRepository } from '../baby/baby-repository';
import { BabyNotFoundError } from '../baby/errors/baby-not-found.error';
import { Appointment } from '../../domain/appointment/appointment';
import { InvalidDoctorNameError } from '../../domain/appointment/errors/invalid-doctor-name.error';
import { AppointmentRepository } from './appointment-repository';
import { AppointmentNotFoundError } from './errors/appointment-not-found.error';

export interface UpdateAppointmentInput {
  babyId: string;
  appointmentId: string;
  requestingUserId: string;
  scheduledAt?: Date;
  doctorName?: string;
  location?: string | null;
  reason?: string | null;
  notes?: string | null;
  status?: 'COMPLETED' | 'CANCELLED';
  referenceDate?: Date;
}

function normalizeDoctorName(name: string): string {
  const trimmed = name.trim();

  if (trimmed.length === 0) {
    throw new InvalidDoctorNameError();
  }

  return trimmed;
}

export class UpdateAppointmentUseCase {
  constructor(
    private readonly babyRepository: BabyRepository,
    private readonly appointmentRepository: AppointmentRepository,
  ) {}

  async execute(input: UpdateAppointmentInput): Promise<Appointment> {
    const baby = await this.babyRepository.findById(input.babyId);

    if (!baby || baby.userId !== input.requestingUserId) {
      throw new BabyNotFoundError();
    }

    const existingAppointment = await this.appointmentRepository.findById(input.appointmentId);

    if (!existingAppointment || existingAppointment.babyId !== input.babyId) {
      throw new AppointmentNotFoundError();
    }

    if (input.scheduledAt) {
      Appointment.assertNotInThePast(input.scheduledAt, input.referenceDate);
    }

    const updatedAppointment = Appointment.restore({
      id: existingAppointment.id,
      babyId: existingAppointment.babyId,
      scheduledAt: input.scheduledAt ?? existingAppointment.scheduledAt,
      doctorName: input.doctorName ? normalizeDoctorName(input.doctorName) : existingAppointment.doctorName,
      location: input.location !== undefined ? input.location : existingAppointment.location,
      reason: input.reason !== undefined ? input.reason : existingAppointment.reason,
      notes: input.notes !== undefined ? input.notes : existingAppointment.notes,
      status: input.status ?? existingAppointment.status,
      createdAt: existingAppointment.createdAt,
    });

    await this.appointmentRepository.save(updatedAppointment);

    return updatedAppointment;
  }
}
