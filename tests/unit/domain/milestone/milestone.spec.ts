import { describe, expect, it } from 'vitest';
import { Milestone } from '../../../../src/domain/milestone/milestone';
import { FutureMilestoneDateError } from '../../../../src/domain/milestone/errors/future-milestone-date.error';
import { MilestoneBeforeBirthError } from '../../../../src/domain/milestone/errors/milestone-before-birth.error';
import { InvalidMilestoneTitleError } from '../../../../src/domain/milestone/errors/invalid-milestone-title.error';

const babyBirthDate = new Date('2024-01-01T00:00:00.000Z');

describe('Milestone.record', () => {
  it('records a milestone achieved between birth and today', () => {
    const milestone = Milestone.record({
      id: 'milestone-1',
      babyId: 'baby-1',
      title: 'Primeiro sorriso',
      achievedAt: new Date('2024-03-01T00:00:00.000Z'),
      category: 'SOCIAL',
      babyBirthDate,
      referenceDate: new Date('2024-06-01T00:00:00.000Z'),
    });

    expect(milestone.title).toBe('Primeiro sorriso');
    expect(milestone.category).toBe('SOCIAL');
  });

  it('allows achievedAt to be exactly the birth date', () => {
    const milestone = Milestone.record({
      id: 'milestone-1',
      babyId: 'baby-1',
      title: 'Nasceu com 3.2kg',
      achievedAt: babyBirthDate,
      category: 'OTHER',
      babyBirthDate,
      referenceDate: new Date('2024-06-01T00:00:00.000Z'),
    });

    expect(milestone.achievedAt).toEqual(babyBirthDate);
  });

  it('allows achievedAt to be exactly today', () => {
    const today = new Date('2024-06-01T00:00:00.000Z');

    const milestone = Milestone.record({
      id: 'milestone-1',
      babyId: 'baby-1',
      title: 'Primeiros passos',
      achievedAt: today,
      category: 'MOTOR',
      babyBirthDate,
      referenceDate: today,
    });

    expect(milestone.achievedAt).toEqual(today);
  });

  it('rejects an achievedAt in the future', () => {
    expect(() =>
      Milestone.record({
        id: 'milestone-1',
        babyId: 'baby-1',
        title: 'Primeiros passos',
        achievedAt: new Date('2024-07-01T00:00:00.000Z'),
        category: 'MOTOR',
        babyBirthDate,
        referenceDate: new Date('2024-06-01T00:00:00.000Z'),
      }),
    ).toThrow(FutureMilestoneDateError);
  });

  it('rejects an achievedAt before the birth date', () => {
    expect(() =>
      Milestone.record({
        id: 'milestone-1',
        babyId: 'baby-1',
        title: 'Impossível',
        achievedAt: new Date('2023-12-31T00:00:00.000Z'),
        category: 'OTHER',
        babyBirthDate,
        referenceDate: new Date('2024-06-01T00:00:00.000Z'),
      }),
    ).toThrow(MilestoneBeforeBirthError);
  });

  it('rejects an empty title', () => {
    expect(() =>
      Milestone.record({
        id: 'milestone-1',
        babyId: 'baby-1',
        title: '   ',
        achievedAt: new Date('2024-03-01T00:00:00.000Z'),
        category: 'OTHER',
        babyBirthDate,
        referenceDate: new Date('2024-06-01T00:00:00.000Z'),
      }),
    ).toThrow(InvalidMilestoneTitleError);
  });
});

describe('Milestone.restore', () => {
  it('reconstructs a milestone without revalidating dates', () => {
    const milestone = Milestone.restore({
      id: 'milestone-1',
      babyId: 'baby-1',
      title: 'Primeiro sorriso',
      description: null,
      achievedAt: new Date('2019-01-01T00:00:00.000Z'),
      category: 'SOCIAL',
      photoUrl: null,
      createdAt: new Date('2019-01-02T00:00:00.000Z'),
    });

    expect(milestone.achievedAt).toEqual(new Date('2019-01-01T00:00:00.000Z'));
  });
});
