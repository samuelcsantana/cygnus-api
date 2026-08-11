import { describe, expect, it, vi } from 'vitest';
import { ListBabyAppointmentsUseCase } from '../../../../src/application/appointment/list-baby-appointments.use-case';
import { BabyNotFoundError } from '../../../../src/application/baby/errors/baby-not-found.error';
import { buildAppointment, buildAppointmentRepository, buildBabyRepository, buildBabyGuardianRepository } from './appointment-test-helpers';

describe('ListBabyAppointmentsUseCase', () => {
  it("returns the owning user's baby appointments", async () => {
    const appointment = buildAppointment();
    const babyRepository = buildBabyRepository();
    const appointmentRepository = buildAppointmentRepository({
      findAllByBabyId: vi.fn().mockResolvedValue([appointment]),
    });
    const useCase = new ListBabyAppointmentsUseCase(babyRepository, buildBabyGuardianRepository(), appointmentRepository);

    const appointments = await useCase.execute({ babyId: 'baby-1', requestingUserId: 'owner-id' });

    expect(appointmentRepository.findAllByBabyId).toHaveBeenCalledWith('baby-1', undefined);
    expect(appointments).toEqual([appointment]);
  });

  it("rejects listing another user's baby appointments", async () => {
    const babyRepository = buildBabyRepository();
    const useCase = new ListBabyAppointmentsUseCase(babyRepository, buildBabyGuardianRepository(), buildAppointmentRepository());

    await expect(useCase.execute({ babyId: 'baby-1', requestingUserId: 'intruder-id' })).rejects.toThrow(
      BabyNotFoundError,
    );
  });

  it('forwards the search term to the repository', async () => {
    const appointment = buildAppointment();
    const babyRepository = buildBabyRepository();
    const appointmentRepository = buildAppointmentRepository({
      findAllByBabyId: vi.fn().mockResolvedValue([appointment]),
    });
    const useCase = new ListBabyAppointmentsUseCase(babyRepository, buildBabyGuardianRepository(), appointmentRepository);

    await useCase.execute({ babyId: 'baby-1', requestingUserId: 'owner-id', search: 'Ana' });

    expect(appointmentRepository.findAllByBabyId).toHaveBeenCalledWith('baby-1', 'Ana');
  });
});
