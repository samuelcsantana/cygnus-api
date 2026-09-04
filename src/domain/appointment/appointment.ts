import { InvalidDoctorNameError } from './errors/invalid-doctor-name.error';
import { FutureVisitRecordError } from './errors/future-visit-record.error';
import { MeasurementBeforeVisitError } from './errors/measurement-before-visit.error';
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
  weightGrams: number | null;
  heightMillimeters: number | null;
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
  weightGrams?: number | null;
  heightMillimeters?: number | null;
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
  readonly weightGrams: number | null;
  readonly heightMillimeters: number | null;
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
    this.weightGrams = props.weightGrams;
    this.heightMillimeters = props.heightMillimeters;
    this.createdAt = props.createdAt;
  }

  // Only enforced here (creation/explicit reschedule), never on plain reconstruction,
  // so completing or cancelling an appointment whose time has since passed still works.
  static assertNotInThePast(scheduledAt: Date, referenceDate: Date = new Date()): void {
    if (scheduledAt.getTime() < referenceDate.getTime()) {
      throw new PastAppointmentDateError();
    }
  }

  // The mirror of assertNotInThePast, and the reason recording a past visit is its own factory
  // rather than a `schedule` with the check relaxed. A visit entered as already done cannot be in
  // the future, exactly as one entered as upcoming cannot be in the past; both are data-entry
  // mistakes, and one lenient path that accepted any date would catch neither.
  static assertNotInTheFuture(scheduledAt: Date, referenceDate: Date = new Date()): void {
    if (scheduledAt.getTime() > referenceDate.getTime()) {
      throw new FutureVisitRecordError();
    }
  }

  /**
   * A weight or a height is something a scale and a stadiometer produced during the visit, so a
   * visit still in the future cannot carry either.
   *
   * This is not tidiness. These rows are the growth series, and a measurement attached to an
   * appointment that has not happened would plot a point in the future — visibly wrong on a chart,
   * and impossible to tell apart from a real one once stored.
   */
  static assertMeasurementsFollowTheVisit(
    status: AppointmentStatus,
    weightGrams: number | null | undefined,
    heightMillimeters: number | null | undefined,
  ): void {
    if (status !== 'SCHEDULED') {
      return;
    }

    const hasWeight = weightGrams !== null && weightGrams !== undefined;
    const hasHeight = heightMillimeters !== null && heightMillimeters !== undefined;

    if (hasWeight || hasHeight) {
      throw new MeasurementBeforeVisitError();
    }
  }

  static schedule(props: ScheduleAppointmentProps): Appointment {
    const doctorName = props.doctorName.trim();

    if (doctorName.length === 0) {
      throw new InvalidDoctorNameError();
    }

    Appointment.assertNotInThePast(props.scheduledAt, props.referenceDate);
    Appointment.assertMeasurementsFollowTheVisit('SCHEDULED', props.weightGrams, props.heightMillimeters);

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
      weightGrams: null,
      heightMillimeters: null,
      createdAt: props.createdAt ?? new Date(),
    });
  }

  /**
   * A consultation that already happened, entered after the fact.
   *
   * Not a variant of scheduling: the appointment is born COMPLETED, because there was never a
   * moment when it was upcoming. Everything a parent actually wants to keep — who they saw, when,
   * where, and what was said — is the same, which is why it is the same entity and not a second
   * one beside it.
   */
  static record(props: ScheduleAppointmentProps): Appointment {
    const doctorName = props.doctorName.trim();

    if (doctorName.length === 0) {
      throw new InvalidDoctorNameError();
    }

    Appointment.assertNotInTheFuture(props.scheduledAt, props.referenceDate);

    return new Appointment({
      id: props.id,
      babyId: props.babyId,
      scheduledAt: props.scheduledAt,
      doctorName,
      specialty: props.specialty ?? null,
      location: props.location ?? null,
      reason: props.reason ?? null,
      notes: null,
      status: 'COMPLETED',
      weightGrams: props.weightGrams ?? null,
      heightMillimeters: props.heightMillimeters ?? null,
      createdAt: props.createdAt ?? new Date(),
    });
  }

  static restore(props: AppointmentProps): Appointment {
    return new Appointment(props);
  }
}
