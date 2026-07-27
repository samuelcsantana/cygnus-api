import { describe, expect, it } from 'vitest';
import { Appointment } from '../../../../src/domain/appointment/appointment';
import { PastAppointmentDateError } from '../../../../src/domain/appointment/errors/past-appointment-date.error';
import { InvalidDoctorNameError } from '../../../../src/domain/appointment/errors/invalid-doctor-name.error';

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
