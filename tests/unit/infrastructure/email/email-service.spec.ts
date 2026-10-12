import { beforeEach, describe, expect, it, vi } from 'vitest';

const sendMock = vi.fn();

vi.mock('resend', () => ({
  Resend: vi.fn().mockImplementation(function () {
    return { emails: { send: sendMock } };
  }),
}));

const { EmailService } = await import('../../../../src/infrastructure/email/email-service');

describe('EmailService.send', () => {
  beforeEach(() => {
    sendMock.mockReset();
    sendMock.mockResolvedValue({ data: { id: 'email-id' }, error: null });
  });

  it('hands a deliverable address to Resend', async () => {
    const service = new EmailService('re_test_key', 'Cygnus <noreply@example.com>');

    await service.send({ to: 'parent@example.com', subject: 'Hello', html: '<p>Hi</p>' });

    expect(sendMock).toHaveBeenCalledTimes(1);
  });

  it('never hands Resend an address on the reserved .invalid domain, where demo accounts live', async () => {
    const service = new EmailService('re_test_key', 'Cygnus <noreply@example.com>');

    await service.sendAccountDeletionCodeEmail('demo-1234@demo.cygnus.invalid', '123456');
    await service.send({ to: ' Someone@Example.INVALID ', subject: 'Hello', html: '<p>Hi</p>' });

    expect(sendMock).not.toHaveBeenCalled();
  });
});
