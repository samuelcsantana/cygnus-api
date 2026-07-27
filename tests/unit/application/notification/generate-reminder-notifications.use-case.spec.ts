import { describe, expect, it, vi } from 'vitest';
import { GenerateReminderNotificationsUseCase } from '../../../../src/application/notification/generate-reminder-notifications.use-case';
import { Appointment } from '../../../../src/domain/appointment/appointment';
import {
  buildAppointment,
  buildAppointmentRepository,
  buildBaby,
  buildBabyRepository,
  buildBabyVaccineRecordRepository,
  buildNotificationRepository,
  buildVaccine,
  buildVaccineRepository,
} from './notification-test-helpers';

const referenceDate = new Date('2024-06-01T00:00:00.000Z');

function buildUseCase(overrides: {
  babyRepository?: ReturnType<typeof buildBabyRepository>;
  vaccineRepository?: ReturnType<typeof buildVaccineRepository>;
  babyVaccineRecordRepository?: ReturnType<typeof buildBabyVaccineRecordRepository>;
  appointmentRepository?: ReturnType<typeof buildAppointmentRepository>;
  notificationRepository?: ReturnType<typeof buildNotificationRepository>;
} = {}) {
  return new GenerateReminderNotificationsUseCase(
    overrides.babyRepository ?? buildBabyRepository(),
    overrides.vaccineRepository ?? buildVaccineRepository({ findAll: vi.fn().mockResolvedValue([]) }),
    overrides.babyVaccineRecordRepository ?? buildBabyVaccineRecordRepository(),
    overrides.appointmentRepository ?? buildAppointmentRepository({ findAllByBabyId: vi.fn().mockResolvedValue([]) }),
    overrides.notificationRepository ?? buildNotificationRepository(),
  );
}

describe('GenerateReminderNotificationsUseCase — vaccines', () => {
  it('creates a notification for a delayed, unapplied vaccine', async () => {
    const baby = buildBaby({ birthDate: new Date('2024-01-01T00:00:00.000Z') });
    const vaccine = buildVaccine({ recommendedAgeInMonths: 0 });
    const notificationRepository = buildNotificationRepository();
    const useCase = buildUseCase({
      babyRepository: buildBabyRepository({ findAll: vi.fn().mockResolvedValue([baby]) }),
      vaccineRepository: buildVaccineRepository({ findAll: vi.fn().mockResolvedValue([vaccine]) }),
      notificationRepository,
    });

    const result = await useCase.execute(referenceDate);

    expect(result.createdCount).toBe(1);
    expect(notificationRepository.save).toHaveBeenCalledTimes(1);
    const savedNotification = vi.mocked(notificationRepository.save).mock.calls[0][0];
    expect(savedNotification.type).toBe('VACCINE_DELAYED');
    expect(savedNotification.referenceId).toBe(vaccine.id);
  });

  it('skips a vaccine that has already been applied', async () => {
    const baby = buildBaby({ birthDate: new Date('2024-01-01T00:00:00.000Z') });
    const vaccine = buildVaccine({ recommendedAgeInMonths: 0 });
    const notificationRepository = buildNotificationRepository();
    const useCase = buildUseCase({
      babyRepository: buildBabyRepository({ findAll: vi.fn().mockResolvedValue([baby]) }),
      vaccineRepository: buildVaccineRepository({ findAll: vi.fn().mockResolvedValue([vaccine]) }),
      babyVaccineRecordRepository: buildBabyVaccineRecordRepository({
        findAllByBabyId: vi.fn().mockResolvedValue([{ vaccineId: vaccine.id }]),
      }),
      notificationRepository,
    });

    const result = await useCase.execute(referenceDate);

    expect(result.createdCount).toBe(0);
    expect(notificationRepository.save).not.toHaveBeenCalled();
  });

  it('skips a vaccine that is not yet due', async () => {
    const baby = buildBaby({ birthDate: new Date('2024-01-01T00:00:00.000Z') });
    const vaccine = buildVaccine({ recommendedAgeInMonths: 6 });
    const notificationRepository = buildNotificationRepository();
    const useCase = buildUseCase({
      babyRepository: buildBabyRepository({ findAll: vi.fn().mockResolvedValue([baby]) }),
      vaccineRepository: buildVaccineRepository({ findAll: vi.fn().mockResolvedValue([vaccine]) }),
      notificationRepository,
    });

    const result = await useCase.execute(referenceDate);

    expect(result.createdCount).toBe(0);
    expect(notificationRepository.save).not.toHaveBeenCalled();
  });

  it('does not duplicate a notification that already exists for the same trigger', async () => {
    const baby = buildBaby({ birthDate: new Date('2024-01-01T00:00:00.000Z') });
    const vaccine = buildVaccine({ recommendedAgeInMonths: 0 });
    const notificationRepository = buildNotificationRepository({
      existsForTrigger: vi.fn().mockResolvedValue(true),
    });
    const useCase = buildUseCase({
      babyRepository: buildBabyRepository({ findAll: vi.fn().mockResolvedValue([baby]) }),
      vaccineRepository: buildVaccineRepository({ findAll: vi.fn().mockResolvedValue([vaccine]) }),
      notificationRepository,
    });

    const result = await useCase.execute(referenceDate);

    expect(result.createdCount).toBe(0);
    expect(notificationRepository.save).not.toHaveBeenCalled();
  });
});

describe('GenerateReminderNotificationsUseCase — appointments', () => {
  it('creates a notification for an appointment within the 3-day reminder window', async () => {
    const baby = buildBaby();
    const appointment = buildAppointment({
      scheduledAt: new Date('2024-06-02T00:00:00.000Z'),
      referenceDate: new Date('2024-05-01T00:00:00.000Z'),
    });
    const notificationRepository = buildNotificationRepository();
    const useCase = buildUseCase({
      babyRepository: buildBabyRepository({ findAll: vi.fn().mockResolvedValue([baby]) }),
      appointmentRepository: buildAppointmentRepository({ findAllByBabyId: vi.fn().mockResolvedValue([appointment]) }),
      notificationRepository,
    });

    const result = await useCase.execute(referenceDate);

    expect(result.createdCount).toBe(1);
    const savedNotification = vi.mocked(notificationRepository.save).mock.calls[0][0];
    expect(savedNotification.type).toBe('APPOINTMENT_UPCOMING');
    expect(savedNotification.referenceId).toBe(appointment.id);
  });

  it('skips an appointment scheduled beyond the reminder window', async () => {
    const baby = buildBaby();
    const appointment = buildAppointment({
      scheduledAt: new Date('2024-07-01T00:00:00.000Z'),
      referenceDate: new Date('2024-05-01T00:00:00.000Z'),
    });
    const notificationRepository = buildNotificationRepository();
    const useCase = buildUseCase({
      babyRepository: buildBabyRepository({ findAll: vi.fn().mockResolvedValue([baby]) }),
      appointmentRepository: buildAppointmentRepository({ findAllByBabyId: vi.fn().mockResolvedValue([appointment]) }),
      notificationRepository,
    });

    const result = await useCase.execute(referenceDate);

    expect(result.createdCount).toBe(0);
    expect(notificationRepository.save).not.toHaveBeenCalled();
  });

  it('skips an appointment that is not SCHEDULED', async () => {
    const baby = buildBaby();
    const cancelledAppointment = Appointment.restore({
      id: 'appointment-1',
      babyId: baby.id,
      scheduledAt: new Date('2024-06-02T00:00:00.000Z'),
      doctorName: 'Dr. Ana Souza',
      location: null,
      reason: null,
      notes: null,
      status: 'CANCELLED',
      createdAt: new Date('2024-05-01T00:00:00.000Z'),
    });
    const notificationRepository = buildNotificationRepository();
    const useCase = buildUseCase({
      babyRepository: buildBabyRepository({ findAll: vi.fn().mockResolvedValue([baby]) }),
      appointmentRepository: buildAppointmentRepository({
        findAllByBabyId: vi.fn().mockResolvedValue([cancelledAppointment]),
      }),
      notificationRepository,
    });

    const result = await useCase.execute(referenceDate);

    expect(result.createdCount).toBe(0);
    expect(notificationRepository.save).not.toHaveBeenCalled();
  });
});
