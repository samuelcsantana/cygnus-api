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

  // Off production there is no API key, and the assisted sign-in flows still have to answer 200:
  // the service logs what it would have sent and returns instead of throwing.
  it('sends nothing, and does not fail, when no API key is configured', async () => {
    const service = new EmailService(undefined, 'Cygnus <noreply@example.com>');

    await expect(service.sendPasswordResetCodeEmail('parent@example.com', '123456')).resolves.toBeUndefined();
    expect(sendMock).not.toHaveBeenCalled();
  });

  it('puts the code in the subject of a password reset e-mail', async () => {
    const service = new EmailService('re_test_key', 'Cygnus <noreply@example.com>');

    await service.sendPasswordResetCodeEmail('parent@example.com', '482913');

    expect(sendMock).toHaveBeenCalledWith(
      expect.objectContaining({ to: 'parent@example.com', subject: '482913 é o seu código para redefinir a senha do Cygnus' }),
    );
  });

  it('names the vaccine and the child in an overdue reminder', async () => {
    const service = new EmailService('re_test_key', 'Cygnus <noreply@example.com>');

    await service.sendVaccineOverdueEmail('parent@example.com', 'Helena', 'VIP (Poliomielite inativada)');

    const [message] = sendMock.mock.calls[0] as [{ subject: string; html: string }];
    expect(message.subject).toBe('Vacina atrasada: VIP (Poliomielite inativada) (Helena)');
    expect(message.html).toContain('<strong>VIP (Poliomielite inativada)</strong> de Helena');
  });

  // The web stores 10:00 in São Paulo as 13:00 UTC. Formatted in UTC, the reminder told the parent
  // to come three hours late.
  it('writes the appointment time in Brasília time, and says so', async () => {
    const service = new EmailService('re_test_key', 'Cygnus <noreply@example.com>');

    await service.sendAppointmentReminderEmail('parent@example.com', 'Helena', 'Dra. Ana Ribeiro', new Date('2026-10-14T13:00:00.000Z'));

    const [message] = sendMock.mock.calls[0] as [{ subject: string; html: string }];
    expect(message.subject).toBe('Consulta próxima: Helena com Dra. Ana Ribeiro');
    expect(message.html).toContain('<strong>14/10/2026, 10:00</strong> (horário de Brasília)');
    expect(message.html).not.toContain('13:00');
  });
});
