import { describe, expect, it } from 'vitest';
import { User } from '../../../../src/domain/user/user';
import { Email } from '../../../../src/domain/user/email.vo';
import { InvalidEmailError } from '../../../../src/domain/user/errors/invalid-email.error';
import { InvalidNameError } from '../../../../src/domain/user/errors/invalid-name.error';

describe('Email.create', () => {
  it('normalizes case and surrounding spaces, so one inbox is one account', () => {
    expect(Email.create('  Parent@Example.COM ').toString()).toBe('parent@example.com');
  });

  it.each(['parent', 'parent@', 'parent@example', 'pa rent@example.com'])('rejects %j', (raw) => {
    expect(() => Email.create(raw)).toThrow(InvalidEmailError);
  });
});

describe('User.create', () => {
  it('rejects a name that is only whitespace', () => {
    expect(() => User.create({ id: 'user-1', email: 'parent@example.com', passwordHash: 'h', name: '   ' }))
      .toThrow(InvalidNameError);
  });

  it('rejects an address that is not an e-mail', () => {
    expect(() => User.create({ id: 'user-1', email: 'not-an-email', passwordHash: 'h', name: 'Jane' }))
      .toThrow(InvalidEmailError);
  });
});
