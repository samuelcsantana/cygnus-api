import { describe, expect, it, vi } from 'vitest';
import { DeleteAppointmentUseCase } from '../../../../src/application/appointment/delete-appointment.use-case';
import { BabyNotFoundError } from '../../../../src/application/baby/errors/baby-not-found.error';
import { AppointmentNotFoundError } from '../../../../src/application/appointment/errors/appointment-not-found.error';
import {
  buildAppointment,
  buildAppointmentRepository,
  buildBaby,
  buildBabyGuardianRepository,
  buildBabyRepository,
} from './appointment-test-helpers';

describe('DeleteAppointmentUseCase', () => {
  it('deletes the appointment when the baby belongs to the requesting user', async () => {
    const baby = buildBaby({ userId: 'owner-id' });
    const appointment = buildAppointment({ babyId: baby.id });
    const deleteFn = vi.fn().mockResolvedValue(undefined);
    const babyRepository = buildBabyRepository({ findById: vi.fn().mockResolvedValue(baby) });
    const appointmentRepository = buildAppointmentRepository({
      findById: vi.fn().mockResolvedValue(appointment),
      delete: deleteFn,
    });
    const useCase = new DeleteAppointmentUseCase(babyRepository, buildBabyGuardianRepository(), appointmentRepository);

    await useCase.execute({ babyId: baby.id, appointmentId: appointment.id, requestingUserId: 'owner-id' });

    expect(deleteFn).toHaveBeenCalledWith(appointment.id);
  });

  it('deletes a completed appointment too, because a typo in the past is still a typo', async () => {
    const baby = buildBaby({ userId: 'owner-id' });
    const appointment = buildAppointment({ babyId: baby.id, status: 'COMPLETED' });
    const deleteFn = vi.fn().mockResolvedValue(undefined);
    const babyRepository = buildBabyRepository({ findById: vi.fn().mockResolvedValue(baby) });
    const appointmentRepository = buildAppointmentRepository({
      findById: vi.fn().mockResolvedValue(appointment),
      delete: deleteFn,
    });
    const useCase = new DeleteAppointmentUseCase(babyRepository, buildBabyGuardianRepository(), appointmentRepository);

    await useCase.execute({ babyId: baby.id, appointmentId: appointment.id, requestingUserId: 'owner-id' });

    expect(deleteFn).toHaveBeenCalledWith(appointment.id);
  });

  it('rejects with BabyNotFoundError when the baby belongs to another user', async () => {
    const baby = buildBaby({ userId: 'owner-id' });
    const appointment = buildAppointment({ babyId: baby.id });
    const deleteFn = vi.fn().mockResolvedValue(undefined);
    const babyRepository = buildBabyRepository({ findById: vi.fn().mockResolvedValue(baby) });
    const appointmentRepository = buildAppointmentRepository({
      findById: vi.fn().mockResolvedValue(appointment),
      delete: deleteFn,
    });
    const useCase = new DeleteAppointmentUseCase(babyRepository, buildBabyGuardianRepository(), appointmentRepository);

    await expect(
      useCase.execute({ babyId: baby.id, appointmentId: appointment.id, requestingUserId: 'intruder-id' }),
    ).rejects.toThrow(BabyNotFoundError);
    expect(deleteFn).not.toHaveBeenCalled();
  });

  it('rejects with AppointmentNotFoundError when the appointment does not exist', async () => {
    const baby = buildBaby({ userId: 'owner-id' });
    const deleteFn = vi.fn().mockResolvedValue(undefined);
    const babyRepository = buildBabyRepository({ findById: vi.fn().mockResolvedValue(baby) });
    const appointmentRepository = buildAppointmentRepository({
      findById: vi.fn().mockResolvedValue(null),
      delete: deleteFn,
    });
    const useCase = new DeleteAppointmentUseCase(babyRepository, buildBabyGuardianRepository(), appointmentRepository);

    await expect(
      useCase.execute({ babyId: baby.id, appointmentId: 'missing-id', requestingUserId: 'owner-id' }),
    ).rejects.toThrow(AppointmentNotFoundError);
    expect(deleteFn).not.toHaveBeenCalled();
  });

  it('rejects when the appointment belongs to a different baby, even one the caller can reach', async () => {
    const baby = buildBaby({ userId: 'owner-id' });
    const appointment = buildAppointment({ babyId: 'another-baby-id' });
    const deleteFn = vi.fn().mockResolvedValue(undefined);
    const babyRepository = buildBabyRepository({ findById: vi.fn().mockResolvedValue(baby) });
    const appointmentRepository = buildAppointmentRepository({
      findById: vi.fn().mockResolvedValue(appointment),
      delete: deleteFn,
    });
    const useCase = new DeleteAppointmentUseCase(babyRepository, buildBabyGuardianRepository(), appointmentRepository);

    await expect(
      useCase.execute({ babyId: baby.id, appointmentId: appointment.id, requestingUserId: 'owner-id' }),
    ).rejects.toThrow(AppointmentNotFoundError);
    expect(deleteFn).not.toHaveBeenCalled();
  });
});
