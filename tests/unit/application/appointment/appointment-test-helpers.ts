import { vi } from 'vitest';
import { BabyRepository } from '../../../../src/application/baby/baby-repository';
import { AppointmentRepository } from '../../../../src/application/appointment/appointment-repository';
import { Baby } from '../../../../src/domain/baby/baby';
import { Appointment } from '../../../../src/domain/appointment/appointment';

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

export function buildBabyRepository(overrides: Partial<BabyRepository> = {}): BabyRepository {
  return {
    findById: vi.fn().mockResolvedValue(buildBaby()),
    findAllByUserId: vi.fn().mockResolvedValue([]),
    findAll: vi.fn().mockResolvedValue([]),
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
