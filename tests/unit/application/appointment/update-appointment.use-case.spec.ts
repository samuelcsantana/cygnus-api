import { describe, expect, it, vi } from 'vitest';
import { UpdateAppointmentUseCase } from '../../../../src/application/appointment/update-appointment.use-case';
import { BabyNotFoundError } from '../../../../src/application/baby/errors/baby-not-found.error';
import { AppointmentNotFoundError } from '../../../../src/application/appointment/errors/appointment-not-found.error';
import { PastAppointmentDateError } from '../../../../src/domain/appointment/errors/past-appointment-date.error';
import { MeasurementBeforeVisitError } from '../../../../src/domain/appointment/errors/measurement-before-visit.error';
import { buildAppointment, buildAppointmentRepository, buildBabyRepository, buildBabyGuardianRepository } from './appointment-test-helpers';

describe('UpdateAppointmentUseCase', () => {
  it('marks a past-due appointment as COMPLETED without revalidating its original date', async () => {
    const pastAppointment = buildAppointment({
      scheduledAt: new Date('2020-01-01T00:00:00.000Z'),
      referenceDate: new Date('2019-12-01T00:00:00.000Z'),
    });
    const babyRepository = buildBabyRepository();
    const appointmentRepository = buildAppointmentRepository({
      findById: vi.fn().mockResolvedValue(pastAppointment),
    });
    const useCase = new UpdateAppointmentUseCase(babyRepository, buildBabyGuardianRepository(), appointmentRepository);

    const updated = await useCase.execute({
      babyId: 'baby-1',
      appointmentId: pastAppointment.id,
      requestingUserId: 'owner-id',
      status: 'COMPLETED',
      notes: 'Baby is healthy, next check-up in 2 months',
    });

    expect(updated.status).toBe('COMPLETED');
    expect(updated.notes).toBe('Baby is healthy, next check-up in 2 months');
    expect(updated.scheduledAt).toEqual(pastAppointment.scheduledAt);
    expect(appointmentRepository.save).toHaveBeenCalledWith(updated);
  });

  it('cancels an appointment', async () => {
    const appointment = buildAppointment();
    const babyRepository = buildBabyRepository();
    const appointmentRepository = buildAppointmentRepository({ findById: vi.fn().mockResolvedValue(appointment) });
    const useCase = new UpdateAppointmentUseCase(babyRepository, buildBabyGuardianRepository(), appointmentRepository);

    const updated = await useCase.execute({
      babyId: 'baby-1',
      appointmentId: appointment.id,
      requestingUserId: 'owner-id',
      status: 'CANCELLED',
    });

    expect(updated.status).toBe('CANCELLED');
  });

  it('reschedules an appointment to a new future date', async () => {
    const appointment = buildAppointment();
    const babyRepository = buildBabyRepository();
    const appointmentRepository = buildAppointmentRepository({ findById: vi.fn().mockResolvedValue(appointment) });
    const useCase = new UpdateAppointmentUseCase(babyRepository, buildBabyGuardianRepository(), appointmentRepository);

    const updated = await useCase.execute({
      babyId: 'baby-1',
      appointmentId: appointment.id,
      requestingUserId: 'owner-id',
      scheduledAt: new Date('2024-07-01T10:00:00.000Z'),
      referenceDate: new Date('2024-06-01T00:00:00.000Z'),
    });

    expect(updated.scheduledAt).toEqual(new Date('2024-07-01T10:00:00.000Z'));
  });

  it('rejects rescheduling to a past date', async () => {
    const appointment = buildAppointment();
    const babyRepository = buildBabyRepository();
    const appointmentRepository = buildAppointmentRepository({ findById: vi.fn().mockResolvedValue(appointment) });
    const useCase = new UpdateAppointmentUseCase(babyRepository, buildBabyGuardianRepository(), appointmentRepository);

    await expect(
      useCase.execute({
        babyId: 'baby-1',
        appointmentId: appointment.id,
        requestingUserId: 'owner-id',
        scheduledAt: new Date('2020-01-01T00:00:00.000Z'),
        referenceDate: new Date('2024-06-01T00:00:00.000Z'),
      }),
    ).rejects.toThrow(PastAppointmentDateError);

    expect(appointmentRepository.save).not.toHaveBeenCalled();
  });

  it("rejects updating another user's appointment", async () => {
    const appointment = buildAppointment();
    const babyRepository = buildBabyRepository();
    const appointmentRepository = buildAppointmentRepository({ findById: vi.fn().mockResolvedValue(appointment) });
    const useCase = new UpdateAppointmentUseCase(babyRepository, buildBabyGuardianRepository(), appointmentRepository);

    await expect(
      useCase.execute({
        babyId: 'baby-1',
        appointmentId: appointment.id,
        requestingUserId: 'intruder-id',
        notes: 'Hacked notes',
      }),
    ).rejects.toThrow(BabyNotFoundError);

    expect(appointmentRepository.save).not.toHaveBeenCalled();
  });

  /**
   * Completing the visit and entering what the scale said is one PATCH, so the rule is checked
   * against the status the appointment *ends up with*. Checking the status it had would force the
   * caller into two requests to satisfy a rule that the single request already satisfies.
   */
  it('accepts measurements in the same request that completes the visit', async () => {
    const appointment = buildAppointment({ scheduledAt: new Date('2024-06-10T14:00:00.000Z') });
    const appointmentRepository = buildAppointmentRepository({
      findById: vi.fn().mockResolvedValue(appointment),
    });
    const useCase = new UpdateAppointmentUseCase(
      buildBabyRepository(),
      buildBabyGuardianRepository(),
      appointmentRepository,
    );

    const updated = await useCase.execute({
      babyId: 'baby-1',
      appointmentId: appointment.id,
      requestingUserId: 'owner-id',
      status: 'COMPLETED',
      weightGrams: 15800,
      heightMillimeters: 1000,
    });

    expect(updated.status).toBe('COMPLETED');
    expect(updated.weightGrams).toBe(15800);
    expect(updated.heightMillimeters).toBe(1000);
  });

  it('refuses a measurement while the visit is still upcoming', async () => {
    const appointment = buildAppointment({ scheduledAt: new Date('2024-06-10T14:00:00.000Z') });
    const appointmentRepository = buildAppointmentRepository({
      findById: vi.fn().mockResolvedValue(appointment),
    });
    const useCase = new UpdateAppointmentUseCase(
      buildBabyRepository(),
      buildBabyGuardianRepository(),
      appointmentRepository,
    );

    await expect(
      useCase.execute({
        babyId: 'baby-1',
        appointmentId: appointment.id,
        requestingUserId: 'owner-id',
        weightGrams: 15800,
      }),
    ).rejects.toThrow(MeasurementBeforeVisitError);

    expect(appointmentRepository.save).not.toHaveBeenCalled();
  });

  it('rejects updating an appointment that does not exist', async () => {
    const babyRepository = buildBabyRepository();
    const appointmentRepository = buildAppointmentRepository({ findById: vi.fn().mockResolvedValue(null) });
    const useCase = new UpdateAppointmentUseCase(babyRepository, buildBabyGuardianRepository(), appointmentRepository);

    await expect(
      useCase.execute({
        babyId: 'baby-1',
        appointmentId: 'missing-id',
        requestingUserId: 'owner-id',
        notes: 'irrelevant',
      }),
    ).rejects.toThrow(AppointmentNotFoundError);
  });
});
