import { vi } from 'vitest';
import { BabyRepository } from '../../../../src/application/baby/baby-repository';
import { BabyGuardianRepository } from '../../../../src/application/baby/baby-guardian-repository';
import { VaccineRepository } from '../../../../src/application/vaccine/vaccine-repository';
import { BabyVaccineRecordRepository } from '../../../../src/application/vaccine/baby-vaccine-record-repository';
import { AppointmentRepository } from '../../../../src/application/appointment/appointment-repository';
import { UserRepository } from '../../../../src/application/user/user-repository';
import { NotificationRepository } from '../../../../src/application/notification/notification-repository';
import { Baby } from '../../../../src/domain/baby/baby';
import { BabyGuardian } from '../../../../src/domain/baby/baby-guardian';
import { Vaccine } from '../../../../src/domain/vaccine/vaccine';
import { Appointment } from '../../../../src/domain/appointment/appointment';
import { User } from '../../../../src/domain/user/user';
import { ReminderEmailSender } from '../../../../src/infrastructure/email/email-service';

export function buildBaby(overrides: Partial<Parameters<typeof Baby.create>[0]> = {}): Baby {
  return Baby.create({
    id: 'baby-1',
    userId: 'owner-id',
    name: 'Baby Doe',
    birthDate: new Date('2024-01-01T00:00:00.000Z'),
    gender: 'FEMALE',
    ...overrides,
  });
}

export function buildBabyGuardian(overrides: Partial<Parameters<typeof BabyGuardian.create>[0]> = {}): BabyGuardian {
  return BabyGuardian.create({
    id: 'guardian-1',
    babyId: 'baby-1',
    userId: 'owner-id',
    role: 'OWNER',
    ...overrides,
  });
}

export function buildBabyGuardianRepository(overrides: Partial<BabyGuardianRepository> = {}): BabyGuardianRepository {
  return {
    findByBabyAndUser: vi.fn().mockResolvedValue(buildBabyGuardian()),
    findAllByBaby: vi.fn().mockResolvedValue([buildBabyGuardian()]),
    findAllByUser: vi.fn().mockResolvedValue([]),
    create: vi.fn().mockResolvedValue(buildBabyGuardian()),
    delete: vi.fn().mockResolvedValue(undefined),
    ...overrides,
  };
}

export function buildReminderUser(overrides: Partial<Parameters<typeof User.create>[0]> = {}): User {
  return User.create({
    id: 'owner-id',
    email: 'owner@example.com',
    passwordHash: 'hashed',
    name: 'Owner Parent',
    emailNotificationsEnabled: true,
    ...overrides,
  });
}

export function buildUserRepository(overrides: Partial<UserRepository> = {}): UserRepository {
  return {
    findById: vi.fn().mockResolvedValue(buildReminderUser()),
    findByEmail: vi.fn().mockResolvedValue(null),
    save: vi.fn().mockResolvedValue(undefined),
    delete: vi.fn().mockResolvedValue(undefined),
    ...overrides,
  };
}

export function buildEmailService(overrides: Partial<ReminderEmailSender> = {}): ReminderEmailSender {
  return {
    sendVaccineOverdueEmail: vi.fn().mockResolvedValue(undefined),
    sendAppointmentReminderEmail: vi.fn().mockResolvedValue(undefined),
    ...overrides,
  };
}

export function buildBabyRepository(overrides: Partial<BabyRepository> = {}): BabyRepository {
  return {
    findById: vi.fn().mockResolvedValue(buildBaby()),
    findAllByUserId: vi.fn().mockResolvedValue([]),
    findAll: vi.fn().mockResolvedValue([buildBaby()]),
    save: vi.fn().mockResolvedValue(undefined),
    ...overrides,
  };
}

export function buildVaccine(overrides: Partial<Parameters<typeof Vaccine.create>[0]> = {}): Vaccine {
  return Vaccine.create({
    id: 'vaccine-1',
    name: 'BCG',
    description: 'Protects against tuberculosis',
    recommendedAgeInMonths: 0,
    doseNumber: 1,
    ...overrides,
  });
}

export function buildVaccineRepository(overrides: Partial<VaccineRepository> = {}): VaccineRepository {
  return {
    findAll: vi.fn().mockResolvedValue([buildVaccine()]),
    findById: vi.fn().mockResolvedValue(buildVaccine()),
    ...overrides,
  };
}

export function buildBabyVaccineRecordRepository(
  overrides: Partial<BabyVaccineRecordRepository> = {},
): BabyVaccineRecordRepository {
  return {
    findAllByBabyId: vi.fn().mockResolvedValue([]),
    findByBabyAndVaccine: vi.fn().mockResolvedValue(null),
    save: vi.fn().mockResolvedValue(undefined),
    ...overrides,
  };
}

export function buildAppointment(overrides: Partial<Parameters<typeof Appointment.schedule>[0]> = {}): Appointment {
  return Appointment.schedule({
    id: 'appointment-1',
    babyId: 'baby-1',
    scheduledAt: new Date('2024-06-10T14:00:00.000Z'),
    doctorName: 'Dr. Ana Souza',
    referenceDate: new Date('2024-06-01T00:00:00.000Z'),
    ...overrides,
  });
}

export function buildAppointmentRepository(overrides: Partial<AppointmentRepository> = {}): AppointmentRepository {
  return {
    findById: vi.fn().mockResolvedValue(null),
    findAllByBabyId: vi.fn().mockResolvedValue([]),
    save: vi.fn().mockResolvedValue(undefined),
    ...overrides,
  };
}

export function buildNotificationRepository(
  overrides: Partial<NotificationRepository> = {},
): NotificationRepository {
  return {
    findById: vi.fn().mockResolvedValue(null),
    findAllByUserId: vi.fn().mockResolvedValue([]),
    existsForTrigger: vi.fn().mockResolvedValue(false),
    save: vi.fn().mockResolvedValue(undefined),
    ...overrides,
  };
}
