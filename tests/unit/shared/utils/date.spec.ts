import { describe, expect, it } from 'vitest';
import { addMonthsClamped, startOfUtcDay } from '../../../../src/shared/utils/date';

describe('addMonthsClamped', () => {
  it('adds whole months when the target month has enough days', () => {
    const result = addMonthsClamped(new Date('2024-01-15T00:00:00.000Z'), 2);
    expect(result.toISOString().slice(0, 10)).toBe('2024-03-15');
  });

  it('clamps to the last day of February in a leap year', () => {
    const result = addMonthsClamped(new Date('2024-01-31T00:00:00.000Z'), 1);
    expect(result.toISOString().slice(0, 10)).toBe('2024-02-29');
  });

  it('clamps to the last day of February in a non-leap year', () => {
    const result = addMonthsClamped(new Date('2023-01-31T00:00:00.000Z'), 1);
    expect(result.toISOString().slice(0, 10)).toBe('2023-02-28');
  });

  it('rolls over into the next year', () => {
    const result = addMonthsClamped(new Date('2024-11-20T00:00:00.000Z'), 2);
    expect(result.toISOString().slice(0, 10)).toBe('2025-01-20');
  });

  it('supports zero months (birth-dose vaccines)', () => {
    const result = addMonthsClamped(new Date('2024-05-10T00:00:00.000Z'), 0);
    expect(result.toISOString().slice(0, 10)).toBe('2024-05-10');
  });
});

describe('startOfUtcDay', () => {
  it('truncates the time portion to UTC midnight', () => {
    const result = startOfUtcDay(new Date('2024-06-15T18:30:00.000Z'));
    expect(result.toISOString()).toBe('2024-06-15T00:00:00.000Z');
  });
});
