import { describe, expect, it } from 'vitest';
import { parseDurationToSeconds } from '../../../../src/shared/utils/parse-duration';

describe('parseDurationToSeconds', () => {
  it.each([
    ['30s', 30],
    ['15m', 900],
    ['12h', 43200],
    ['7d', 604800],
  ])('reads %s as %i seconds', (duration, seconds) => {
    expect(parseDurationToSeconds(duration)).toBe(seconds);
  });

  // JWT_*_EXPIRES_IN feeds this at boot and the cookie Max-Age comes from it: a value it cannot
  // read must stop the server rather than issue cookies with a NaN lifetime.
  it.each(['15', '1w', '1.5h', '-1m', ''])('refuses %j', (duration) => {
    expect(() => parseDurationToSeconds(duration)).toThrow(`Invalid duration format: ${duration}`);
  });
});
