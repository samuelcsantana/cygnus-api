import { describe, expect, it } from 'vitest';
import { DEMO_ACCOUNT_LIFETIME_MS, DEMO_EMAIL_DOMAIN, User } from '../../../../src/domain/user/user';

describe('User.createDemo', () => {
  const now = new Date('2026-10-12T15:00:00.000Z');
  const demo = User.createDemo({ id: 'b7f0c6d2-0000-4000-8000-000000000001', passwordHash: 'h', name: 'Visitor', now });

  it('expires 24 hours after it is created', () => {
    expect(demo.isDemo).toBe(true);
    expect(demo.demoExpiresAt?.getTime()).toBe(now.getTime() + DEMO_ACCOUNT_LIFETIME_MS);
    expect(demo.isExpiredDemoAt(new Date(now.getTime() + DEMO_ACCOUNT_LIFETIME_MS - 1))).toBe(false);
    expect(demo.isExpiredDemoAt(new Date(now.getTime() + DEMO_ACCOUNT_LIFETIME_MS))).toBe(true);
  });

  it('gets an address on the reserved .invalid domain, unique per account', () => {
    expect(demo.email).toBe(`demo-b7f0c6d2-0000-4000-8000-000000000001@${DEMO_EMAIL_DOMAIN}`);
    expect(demo.email.endsWith('.invalid')).toBe(true);
  });

  it('never mails reminders and opens on a name, not on the name form', () => {
    expect(demo.emailNotificationsEnabled).toBe(false);
    expect(demo.name).toBe('Visitor');
  });
});

describe('User demo state', () => {
  it('is absent on an ordinary account, which never expires', () => {
    const user = User.create({ id: 'user-id', email: 'parent@example.com', passwordHash: 'h', name: 'Jane' });

    expect(user.isDemo).toBe(false);
    expect(user.demoExpiresAt).toBeNull();
    expect(user.isExpiredDemoAt(new Date('2999-01-01T00:00:00.000Z'))).toBe(false);
  });
});
