import { describe, expect, it, vi } from 'vitest';
import { GetAppointmentByIdUseCase } from '../../../../src/application/appointment/get-appointment-by-id.use-case';
import { BabyNotFoundError } from '../../../../src/application/baby/errors/baby-not-found.error';
import { AppointmentNotFoundError } from '../../../../src/application/appointment/errors/appointment-not-found.error';
import { buildAppointment, buildAppointmentRepository, buildBabyRepository, buildBabyGuardianRepository } from './appointment-test-helpers';

describe('GetAppointmentByIdUseCase', () => {
  it("returns the appointment when it belongs to the requesting user's baby", async () => {
    const appointment = buildAppointment();
    const babyRepository = buildBabyRepository();
    const appointmentRepository = buildAppointmentRepository({ findById: vi.fn().mockResolvedValue(appointment) });
    const useCase = new GetAppointmentByIdUseCase(babyRepository, buildBabyGuardianRepository(), appointmentRepository);

    const result = await useCase.execute({
      babyId: 'baby-1',
      appointmentId: appointment.id,
      requestingUserId: 'owner-id',
    });

    expect(result).toBe(appointment);
  });

  it("rejects with BabyNotFoundError when the baby belongs to another user", async () => {
    const babyRepository = buildBabyRepository();
    const useCase = new GetAppointmentByIdUseCase(babyRepository, buildBabyGuardianRepository(), buildAppointmentRepository());

    await expect(
      useCase.execute({ babyId: 'baby-1', appointmentId: 'appointment-1', requestingUserId: 'intruder-id' }),
    ).rejects.toThrow(BabyNotFoundError);
  });

  it('rejects with AppointmentNotFoundError when the appointment does not exist', async () => {
    const babyRepository = buildBabyRepository();
    const appointmentRepository = buildAppointmentRepository({ findById: vi.fn().mockResolvedValue(null) });
    const useCase = new GetAppointmentByIdUseCase(babyRepository, buildBabyGuardianRepository(), appointmentRepository);

    await expect(
      useCase.execute({ babyId: 'baby-1', appointmentId: 'missing-id', requestingUserId: 'owner-id' }),
    ).rejects.toThrow(AppointmentNotFoundError);
  });

  it('rejects with AppointmentNotFoundError when the appointment belongs to a different baby', async () => {
    const appointment = buildAppointment({ babyId: 'other-baby-id' });
    const babyRepository = buildBabyRepository();
    const appointmentRepository = buildAppointmentRepository({ findById: vi.fn().mockResolvedValue(appointment) });
    const useCase = new GetAppointmentByIdUseCase(babyRepository, buildBabyGuardianRepository(), appointmentRepository);

    await expect(
      useCase.execute({ babyId: 'baby-1', appointmentId: appointment.id, requestingUserId: 'owner-id' }),
    ).rejects.toThrow(AppointmentNotFoundError);
  });
});
