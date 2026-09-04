import { describe, expect, it } from 'vitest';
import { Specialist } from '../../../../src/domain/specialist/specialist';
import { InvalidSpecialistNameError } from '../../../../src/domain/specialist/errors/invalid-specialist-name.error';

describe('Specialist.register', () => {
  it('trims the name and keeps the phone as typed', () => {
    const specialist = Specialist.register({
      id: 'specialist-1',
      babyId: 'baby-1',
      name: '  Dra. Fernanda Lima  ',
      specialty: 'Pediatria',
      phone: '+55 11 99999-0000',
    });

    expect(specialist.name).toBe('Dra. Fernanda Lima');
    // No normalising of the number: it can be a landline, a mobile, a switchboard with an
    // extension, or one written with the country code, and this is the field somebody reaches for
    // at 3am. Reformatting it risks turning a working number into a wrong one.
    expect(specialist.phone).toBe('+55 11 99999-0000');
  });

  it('rejects an empty name', () => {
    expect(() =>
      Specialist.register({ id: 'specialist-1', babyId: 'baby-1', name: '   ' }),
    ).toThrow(InvalidSpecialistNameError);
  });

  /**
   * A phone stored as a single space looks filled in the list and is useless at the moment it is
   * needed — worse than an empty field, which at least tells the truth.
   */
  it('treats a blank specialty or phone as absent', () => {
    const specialist = Specialist.register({
      id: 'specialist-1',
      babyId: 'baby-1',
      name: 'Dra. Fernanda Lima',
      specialty: '   ',
      phone: '',
    });

    expect(specialist.specialty).toBeNull();
    expect(specialist.phone).toBeNull();
  });
});
