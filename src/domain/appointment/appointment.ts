import { InvalidDoctorNameError } from './errors/invalid-doctor-name.error';
import { PastAppointmentDateError } from './errors/past-appointment-date.error';

export type AppointmentStatus = 'SCHEDULED' | 'COMPLETED' | 'CANCELLED';

export interface AppointmentProps {
  id: string;
  babyId: string;
  scheduledAt: Date;
  doctorName: string;
  specialty: string | null;
  location: string | null;
  reason: string | null;
  notes: string | null;
  status: AppointmentStatus;
  createdAt: Date;
}

export interface ScheduleAppointmentProps {
  id: string;
  babyId: string;
  scheduledAt: Date;
  doctorName: string;
  specialty?: string | null;
  location?: string | null;
  reason?: string | null;
  createdAt?: Date;
  referenceDate?: Date;
}

export class Appointment {
  readonly id: string;
  readonly babyId: string;
  readonly scheduledAt: Date;
  readonly doctorName: string;
  readonly specialty: string | null;
  readonly location: string | null;
  readonly reason: string | null;
  readonly notes: string | null;
  readonly status: AppointmentStatus;
  readonly createdAt: Date;

  private constructor(props: AppointmentProps) {
    this.id = props.id;
    this.babyId = props.babyId;
    this.scheduledAt = props.scheduledAt;
    this.doctorName = props.doctorName;
    this.specialty = props.specialty;
    this.location = props.location;
    this.reason = props.reason;
    this.notes = props.notes;
    this.status = props.status;
    this.createdAt = props.createdAt;
  }

  // Only enforced here (creation/explicit reschedule), never on plain reconstruction,
  // so completing or cancelling an appointment whose time has since passed still works.
  static assertNotInThePast(scheduledAt: Date, referenceDate: Date = new Date()): void {
    if (scheduledAt.getTime() < referenceDate.getTime()) {
      throw new PastAppointmentDateError();
    }
  }

  static schedule(props: ScheduleAppointmentProps): Appointment {
    const doctorName = props.doctorName.trim();

    if (doctorName.length === 0) {
      throw new InvalidDoctorNameError();
    }

    Appointment.assertNotInThePast(props.scheduledAt, props.referenceDate);

    return new Appointment({
      id: props.id,
      babyId: props.babyId,
      scheduledAt: props.scheduledAt,
      doctorName,
      specialty: props.specialty ?? null,
      location: props.location ?? null,
      reason: props.reason ?? null,
      notes: null,
      status: 'SCHEDULED',
      createdAt: props.createdAt ?? new Date(),
    });
  }

  static restore(props: AppointmentProps): Appointment {
    return new Appointment(props);
  }
}
