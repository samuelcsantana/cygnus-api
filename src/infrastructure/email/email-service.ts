import { Resend } from 'resend';
import { logger } from '../../shared/logging/logger';

export interface SendEmailInput {
  to: string;
  subject: string;
  html: string;
}

// Narrow interface covering just the reminder-related template methods, so use cases that only
// need to send reminder emails (e.g. `GenerateReminderNotificationsUseCase`) can depend on this
// instead of the full `EmailService` class — a plain object satisfies it in tests without having
// to duck-type a class with a private field.
export interface ReminderEmailSender {
  sendVaccineOverdueEmail(to: string, babyName: string, vaccineName: string): Promise<void>;
  sendAppointmentReminderEmail(to: string, babyName: string, doctorName: string, scheduledAt: Date): Promise<void>;
}

/**
 * Shared body for the two code e-mails. The code is rendered large and letter-spaced because it is
 * read off the screen and typed into another one — and repeated in the subject line, so it is
 * legible from a notification without opening anything.
 */
function verificationCodeHtml(parts: { heading: string; intro: string; code: string; footer: string }): string {
  return `
      <div style="font-family: sans-serif; max-width: 480px; margin: 0 auto; color: #1f2933;">
        <h1 style="color: #2A9D8F; font-size: 20px;">${parts.heading}</h1>
        <p>${parts.intro}</p>
        <p style="font-size: 32px; font-weight: bold; letter-spacing: 8px; color: #1f2933; margin: 24px 0;">${parts.code}</p>
        <p style="font-size: 13px; color: #6b7280;">${parts.footer}</p>
      </div>
    `.trim();
}

// Thin wrapper around the Resend SDK, kept generic (`send`) so it can be reused for anything
// transactional — guardian invites today, reminder emails later (vaccines/appointments), without
// changing this class. Template-specific methods (like `sendGuardianInviteEmail` below) just build
// the HTML and delegate to `send`.
export class EmailService implements ReminderEmailSender {
  private readonly client: Resend | null;

  constructor(
    private readonly apiKey: string | undefined,
    private readonly fromEmail: string | undefined,
  ) {
    this.client = apiKey ? new Resend(apiKey) : null;
  }

  async send(input: SendEmailInput): Promise<void> {
    if (!this.client || !this.fromEmail) {
      logger.warn(
        { to: input.to, subject: input.subject },
        'email_service.not_configured — RESEND_API_KEY/RESEND_FROM_EMAIL unset, skipping send',
      );
      return;
    }

    const { error } = await this.client.emails.send({
      from: this.fromEmail,
      to: input.to,
      subject: input.subject,
      html: input.html,
    });

    if (error) {
      throw new Error(`Failed to send email via Resend: ${error.message}`);
    }
  }

  async sendGuardianInviteEmail(to: string, inviterName: string, babyName: string, inviteUrl: string): Promise<void> {
    const html = `
      <div style="font-family: sans-serif; max-width: 480px; margin: 0 auto; color: #1f2933;">
        <h1 style="color: #2A9D8F; font-size: 20px;">Você foi convidado(a) para cuidar de ${babyName}</h1>
        <p>${inviterName} convidou você para acompanhar, junto com ele(a), o acompanhamento de saúde de ${babyName} no Cygnus — vacinas, consultas e marcos de desenvolvimento.</p>
        <p>
          <a href="${inviteUrl}" style="display: inline-block; background-color: #2A9D8F; color: #ffffff; padding: 12px 20px; border-radius: 8px; text-decoration: none; font-weight: bold;">
            Aceitar convite
          </a>
        </p>
        <p style="font-size: 13px; color: #6b7280;">Este convite expira em 7 dias. Se você não esperava este e-mail, pode ignorá-lo com segurança.</p>
      </div>
    `.trim();

    await this.send({
      to,
      subject: `${inviterName} convidou você para cuidar de ${babyName}`,
      html,
    });
  }

  async sendPasswordlessCodeEmail(to: string, code: string): Promise<void> {
    await this.send({
      to,
      subject: `${code} é o seu código de acesso ao Cygnus`,
      html: verificationCodeHtml({
        heading: 'Seu código de acesso',
        intro: 'Use o código abaixo para entrar no Cygnus sem senha.',
        code,
        footer:
          'O código vale por 10 minutos e só pode ser usado uma vez. Se não foi você que pediu, ignore este e-mail — ' +
          'ninguém entra na sua conta só por ter pedido o código.',
      }),
    });
  }

  async sendPasswordResetCodeEmail(to: string, code: string): Promise<void> {
    await this.send({
      to,
      subject: `${code} é o seu código para redefinir a senha do Cygnus`,
      html: verificationCodeHtml({
        heading: 'Redefinir sua senha',
        intro: 'Use o código abaixo para criar uma nova senha do Cygnus.',
        code,
        footer:
          'O código vale por 10 minutos e só pode ser usado uma vez. Ao redefinir a senha, você sai de todos os ' +
          'outros aparelhos conectados. Se não foi você que pediu, ignore este e-mail: sua senha atual continua valendo.',
      }),
    });
  }

  async sendVaccineOverdueEmail(to: string, babyName: string, vaccineName: string): Promise<void> {
    const html = `
      <div style="font-family: sans-serif; max-width: 480px; margin: 0 auto; color: #1f2933;">
        <h1 style="color: #2A9D8F; font-size: 20px;">Vacina atrasada: ${vaccineName}</h1>
        <p>A vacina <strong>${vaccineName}</strong> de ${babyName} está atrasada no calendário de vacinação.</p>
        <p>Acesse o Cygnus para registrar a aplicação ou reagendar com o pediatra.</p>
        <p style="font-size: 13px; color: #6b7280;">Você está recebendo este e-mail porque é responsável por ${babyName} no Cygnus. Você pode desativar lembretes por e-mail nas configurações do seu perfil.</p>
      </div>
    `.trim();

    await this.send({
      to,
      subject: `Vacina atrasada: ${vaccineName} (${babyName})`,
      html,
    });
  }

  async sendAppointmentReminderEmail(to: string, babyName: string, doctorName: string, scheduledAt: Date): Promise<void> {
    const formattedDate = scheduledAt.toLocaleString('pt-BR', { timeZone: 'UTC', dateStyle: 'short', timeStyle: 'short' });
    const html = `
      <div style="font-family: sans-serif; max-width: 480px; margin: 0 auto; color: #1f2933;">
        <h1 style="color: #2A9D8F; font-size: 20px;">Consulta próxima de ${babyName}</h1>
        <p>${babyName} tem consulta marcada com <strong>${doctorName}</strong> em <strong>${formattedDate}</strong>.</p>
        <p>Acesse o Cygnus para ver mais detalhes ou reagendar, se necessário.</p>
        <p style="font-size: 13px; color: #6b7280;">Você está recebendo este e-mail porque é responsável por ${babyName} no Cygnus. Você pode desativar lembretes por e-mail nas configurações do seu perfil.</p>
      </div>
    `.trim();

    await this.send({
      to,
      subject: `Consulta próxima: ${babyName} com ${doctorName}`,
      html,
    });
  }
}
