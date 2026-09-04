import { describe, expect, it } from 'vitest';
import { Appointment } from '../../../../src/domain/appointment/appointment';
import { PastAppointmentDateError } from '../../../../src/domain/appointment/errors/past-appointment-date.error';
import { FutureVisitRecordError } from '../../../../src/domain/appointment/errors/future-visit-record.error';
import { InvalidDoctorNameError } from '../../../../src/domain/appointment/errors/invalid-doctor-name.error';
import { MeasurementBeforeVisitError } from '../../../../src/domain/appointment/errors/measurement-before-visit.error';

describe('Appointment.schedule', () => {
  it('schedules an appointment for a future date', () => {
    const appointment = Appointment.schedule({
      id: 'appointment-1',
      babyId: 'baby-1',
      scheduledAt: new Date('2024-06-10T14:00:00.000Z'),
      doctorName: 'Dr. Ana Souza',
      referenceDate: new Date('2024-06-01T00:00:00.000Z'),
    });

    expect(appointment.status).toBe('SCHEDULED');
    expect(appointment.notes).toBeNull();
  });

  it('rejects a scheduledAt in the past', () => {
    expect(() =>
      Appointment.schedule({
        id: 'appointment-1',
        babyId: 'baby-1',
        scheduledAt: new Date('2024-01-01T00:00:00.000Z'),
        doctorName: 'Dr. Ana Souza',
        referenceDate: new Date('2024-06-01T00:00:00.000Z'),
      }),
    ).toThrow(PastAppointmentDateError);
  });

  it('rejects an empty doctor name', () => {
    expect(() =>
      Appointment.schedule({
        id: 'appointment-1',
        babyId: 'baby-1',
        scheduledAt: new Date('2024-06-10T14:00:00.000Z'),
        doctorName: '   ',
        referenceDate: new Date('2024-06-01T00:00:00.000Z'),
      }),
    ).toThrow(InvalidDoctorNameError);
  });
});

describe('Appointment.restore', () => {
  it('reconstructs a COMPLETED appointment whose scheduledAt is in the past without revalidating the date', () => {
    const appointment = Appointment.restore({
      id: 'appointment-1',
      babyId: 'baby-1',
      scheduledAt: new Date('2020-01-01T00:00:00.000Z'),
      doctorName: 'Dr. Ana Souza',
      location: null,
      reason: null,
      notes: 'All good',
      status: 'COMPLETED',
      createdAt: new Date('2019-12-01T00:00:00.000Z'),
    });

    expect(appointment.status).toBe('COMPLETED');
    expect(appointment.scheduledAt).toEqual(new Date('2020-01-01T00:00:00.000Z'));
  });
});

describe('Appointment.record', () => {
  it('records a consultation that already happened as COMPLETED', () => {
    const appointment = Appointment.record({
      id: 'appointment-1',
      babyId: 'baby-1',
      scheduledAt: new Date('2024-05-20T14:00:00.000Z'),
      doctorName: 'Dr. Ana Souza',
      specialty: 'Pediatria',
      referenceDate: new Date('2024-06-01T00:00:00.000Z'),
    });

    // Born COMPLETED rather than scheduled and then completed: there was never a moment when
    // this visit was upcoming.
    expect(appointment.status).toBe('COMPLETED');
    expect(appointment.scheduledAt).toEqual(new Date('2024-05-20T14:00:00.000Z'));
    expect(appointment.specialty).toBe('Pediatria');
  });

  it('rejects a scheduledAt in the future', () => {
    // The mirror of what schedule() rejects. Something cannot already have happened tomorrow.
    expect(() =>
      Appointment.record({
        id: 'appointment-1',
        babyId: 'baby-1',
        scheduledAt: new Date('2024-06-10T14:00:00.000Z'),
        doctorName: 'Dr. Ana Souza',
        referenceDate: new Date('2024-06-01T00:00:00.000Z'),
      }),
    ).toThrow(FutureVisitRecordError);
  });

  it('rejects an empty doctor name', () => {
    expect(() =>
      Appointment.record({
        id: 'appointment-1',
        babyId: 'baby-1',
        scheduledAt: new Date('2024-05-20T14:00:00.000Z'),
        doctorName: '   ',
        referenceDate: new Date('2024-06-01T00:00:00.000Z'),
      }),
    ).toThrow(InvalidDoctorNameError);
  });
});

/**
 * Weight and height are what a scale and a stadiometer produced *during* the visit, so the entity
 * refuses to hold either on a visit that has not happened.
 *
 * The reason is not tidiness. These rows are the growth series: a measurement on an appointment
 * still in the future plots a point in the future, and once stored there is nothing to tell it
 * apart from a real one.
 */
describe('Appointment measurements', () => {
  it('keeps a recorded visit’s weight and height', () => {
    const appointment = Appointment.record({
      id: 'appointment-1',
      babyId: 'baby-1',
      scheduledAt: new Date('2024-05-20T14:00:00.000Z'),
      doctorName: 'Dr. Ana Souza',
      weightGrams: 15800,
      heightMillimeters: 1000,
      referenceDate: new Date('2024-06-01T00:00:00.000Z'),
    });

    expect(appointment.weightGrams).toBe(15800);
    expect(appointment.heightMillimeters).toBe(1000);
  });

  it('refuses a measurement on a visit that has not happened yet', () => {
    expect(() =>
      Appointment.schedule({
        id: 'appointment-1',
        babyId: 'baby-1',
        scheduledAt: new Date('2024-06-10T14:00:00.000Z'),
        doctorName: 'Dr. Ana Souza',
        weightGrams: 15800,
        referenceDate: new Date('2024-06-01T00:00:00.000Z'),
      }),
    ).toThrow(MeasurementBeforeVisitError);
  });

  it('leaves a scheduled visit with no measurement rather than a zero', () => {
    const appointment = Appointment.schedule({
      id: 'appointment-1',
      babyId: 'baby-1',
      scheduledAt: new Date('2024-06-10T14:00:00.000Z'),
      doctorName: 'Dr. Ana Souza',
      referenceDate: new Date('2024-06-01T00:00:00.000Z'),
    });

    expect(appointment.weightGrams).toBeNull();
    expect(appointment.heightMillimeters).toBeNull();
  });
});
