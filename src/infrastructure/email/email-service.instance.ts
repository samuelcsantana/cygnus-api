import { env } from '../../shared/config/env';
import { EmailService } from './email-service';

export const emailService = new EmailService(env.RESEND_API_KEY, env.RESEND_FROM_EMAIL);
