import { describe, expect, it } from 'vitest';
import { CreateAppointmentUseCase } from '../../../../src/application/appointment/create-appointment.use-case';
import { BabyNotFoundError } from '../../../../src/application/baby/errors/baby-not-found.error';
import { PastAppointmentDateError } from '../../../../src/domain/appointment/errors/past-appointment-date.error';
import { buildAppointmentRepository, buildBabyRepository } from './appointment-test-helpers';

describe('CreateAppointmentUseCase', () => {
  it('schedules a new appointment for the owning user', async () => {
    const babyRepository = buildBabyRepository();
    const appointmentRepository = buildAppointmentRepository();
    const useCase = new CreateAppointmentUseCase(babyRepository, appointmentRepository);

    const appointment = await useCase.execute({
      babyId: 'baby-1',
      requestingUserId: 'owner-id',
      scheduledAt: new Date('2024-06-10T14:00:00.000Z'),
      doctorName: 'Dr. Ana Souza',
      referenceDate: new Date('2024-06-01T00:00:00.000Z'),
    });

    expect(appointment.status).toBe('SCHEDULED');
    expect(appointmentRepository.save).toHaveBeenCalledWith(appointment);
  });

  it("rejects scheduling for another user's baby", async () => {
    const babyRepository = buildBabyRepository();
    const appointmentRepository = buildAppointmentRepository();
    const useCase = new CreateAppointmentUseCase(babyRepository, appointmentRepository);

    await expect(
      useCase.execute({
        babyId: 'baby-1',
        requestingUserId: 'intruder-id',
        scheduledAt: new Date('2024-06-10T14:00:00.000Z'),
        doctorName: 'Dr. Ana Souza',
        referenceDate: new Date('2024-06-01T00:00:00.000Z'),
      }),
    ).rejects.toThrow(BabyNotFoundError);
  });

  it('rejects scheduling an appointment in the past', async () => {
    const babyRepository = buildBabyRepository();
    const appointmentRepository = buildAppointmentRepository();
    const useCase = new CreateAppointmentUseCase(babyRepository, appointmentRepository);

    await expect(
      useCase.execute({
        babyId: 'baby-1',
        requestingUserId: 'owner-id',
        scheduledAt: new Date('2024-01-01T00:00:00.000Z'),
        doctorName: 'Dr. Ana Souza',
        referenceDate: new Date('2024-06-01T00:00:00.000Z'),
      }),
    ).rejects.toThrow(PastAppointmentDateError);

    expect(appointmentRepository.save).not.toHaveBeenCalled();
  });
});
