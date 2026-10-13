import { randomUUID } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { buildDemoDataset, DemoDataset } from '../../../../src/application/demo/demo-dataset';
import { DEMO_ACCOUNT_LIFETIME_MS } from '../../../../src/domain/user/user';
import { BabyVaccineRecord } from '../../../../src/domain/vaccine/baby-vaccine-record';
import { Vaccine } from '../../../../src/domain/vaccine/vaccine';
import { addMonthsClamped, startOfUtcDay } from '../../../../src/shared/utils/date';
import { VACCINE_CATALOG_SEED } from '../../../../prisma/vaccine-catalog-seed-data';

const catalog = VACCINE_CATALOG_SEED.map((entry) =>
  Vaccine.create({ ...entry, id: randomUUID(), effectiveTo: null, isActive: true }),
);

/** The status each catalog vaccine would show, derived exactly as GetBabyVaccineScheduleUseCase does. */
function scheduleStatuses(dataset: DemoDataset, babyId: string, now: Date): string[] {
  const baby = dataset.babies.find((candidate) => candidate.id === babyId)!;
  const applied = new Set(dataset.vaccineRecords.filter((record) => record.babyId === babyId).map((record) => record.vaccineId));

  return catalog.map((vaccine) => {
    if (applied.has(vaccine.id)) return 'APPLIED';
    const dueDate = addMonthsClamped(baby.birthDate, vaccine.recommendedAgeInMonths);
    if (vaccine.recommendationKind !== 'ROUTINE' || dueDate.getTime() < vaccine.effectiveFrom.getTime()) return 'GUIDANCE';
    return BabyVaccineRecord.derive({ id: 'x', babyId, vaccineId: vaccine.id, dueDate, referenceDate: now }).status;
  });
}

// Today, a month end, a leap day and a date years out: the dataset is built from `now`, so it has
// to tell the same story on any of them.
const NOWS = ['2026-10-12T15:00:00.000Z', '2027-03-31T02:30:00.000Z', '2028-02-29T23:59:00.000Z', '2031-07-01T12:00:00.000Z'];

describe.each(NOWS)('buildDemoDataset at %s', (iso) => {
  const now = new Date(iso);
  const today = startOfUtcDay(now);
  const dataset = buildDemoDataset({ now, passwordHash: 'hash', vaccines: catalog });
  const [helena, theo] = dataset.babies;
  if (!helena || !theo) throw new Error('The demo family has two children');

  it('belongs to a demo account that ends 24 hours later', () => {
    expect(dataset.user.isDemo).toBe(true);
    expect(dataset.user.demoExpiresAt?.getTime()).toBe(now.getTime() + DEMO_ACCOUNT_LIFETIME_MS);
  });

  it("shows the baby's card with applied, exactly one overdue, and upcoming doses", () => {
    const statuses = scheduleStatuses(dataset, helena.id, now);

    expect(statuses).toContain('APPLIED');
    expect(statuses.filter((status) => status === 'DELAYED')).toHaveLength(1);
    expect(statuses).toContain('PENDING');
  });

  it("keeps the toddler's card up to date", () => {
    expect(scheduleStatuses(dataset, theo.id, now)).not.toContain('DELAYED');
  });

  it('dates every applied dose between its due date and yesterday', () => {
    for (const record of dataset.vaccineRecords) {
      const baby = dataset.babies.find((candidate) => candidate.id === record.babyId)!;
      expect(record.applicationDate.getTime()).toBeGreaterThanOrEqual(baby.birthDate.getTime());
      expect(record.applicationDate.getTime()).toBeLessThan(today.getTime());
    }
  });

  it('puts an appointment inside the three-day reminder window, and every completed one in the past', () => {
    const upcoming = dataset.appointments.filter((appointment) => appointment.status === 'SCHEDULED');
    const soonest = Math.min(...upcoming.map((appointment) => appointment.scheduledAt.getTime()));

    expect(soonest).toBeGreaterThan(now.getTime());
    expect(soonest - now.getTime()).toBeLessThanOrEqual(3 * 24 * 60 * 60 * 1000);

    for (const appointment of dataset.appointments.filter((item) => item.status === 'COMPLETED')) {
      expect(appointment.scheduledAt.getTime()).toBeLessThan(now.getTime());
      expect(appointment.weightGrams).not.toBeNull();
    }
  });

  it('dates milestones, measurements and medications between birth and today', () => {
    const dated = [
      ...dataset.milestones.map((item) => ({ babyId: item.babyId, date: item.achievedAt })),
      ...dataset.measurements.map((item) => ({ babyId: item.babyId, date: item.measuredOn })),
      ...dataset.medications.map((item) => ({ babyId: item.babyId, date: item.startedOn })),
    ];

    for (const { babyId, date } of dated) {
      const baby = dataset.babies.find((candidate) => candidate.id === babyId)!;
      expect(date.getTime()).toBeGreaterThanOrEqual(baby.birthDate.getTime());
      expect(date.getTime()).toBeLessThanOrEqual(today.getTime());
    }
  });

  it('only references rows it creates', () => {
    const babyIds = new Set(dataset.babies.map((baby) => baby.id));
    const specialistIds = new Set(dataset.specialists.map((specialist) => specialist.id));
    const catalogIds = new Set(catalog.map((vaccine) => vaccine.id));

    for (const row of [...dataset.measurements, ...dataset.vaccineRecords, ...dataset.appointments, ...dataset.milestones, ...dataset.medications]) {
      expect(babyIds.has(row.babyId)).toBe(true);
    }
    for (const appointment of dataset.appointments) {
      expect(specialistIds.has(appointment.specialistId)).toBe(true);
    }
    for (const record of dataset.vaccineRecords) {
      expect(catalogIds.has(record.vaccineId)).toBe(true);
    }
    expect(dataset.specialists.flatMap((specialist) => specialist.babyIds).every((id) => babyIds.has(id))).toBe(true);
  });
});

describe('buildDemoDataset', () => {
  it('builds a new account with new ids on every call', () => {
    const now = new Date('2026-10-12T15:00:00.000Z');
    const first = buildDemoDataset({ now, passwordHash: 'hash', vaccines: catalog });
    const second = buildDemoDataset({ now, passwordHash: 'hash', vaccines: catalog });

    expect(first.user.id).not.toBe(second.user.id);
    expect(first.user.email).not.toBe(second.user.email);
    expect(first.babies[0]?.id).not.toBe(second.babies[0]?.id);
  });

  it('still works with an empty catalog: the family simply has no vaccine records', () => {
    const dataset = buildDemoDataset({ now: new Date(), passwordHash: 'hash', vaccines: [] });

    expect(dataset.vaccineRecords).toEqual([]);
    expect(dataset.babies).toHaveLength(2);
  });
});
