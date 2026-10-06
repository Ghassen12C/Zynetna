import { env, isProd } from '@/lib/env';
import { logger } from '@/lib/logger';

/**
 * Notification transport abstraction.
 *
 * Each channel is an interface with a working development implementation. The
 * console drivers genuinely deliver — to the server log — and the call sites
 * are identical to what a production SMTP or SMS driver will see, so swapping
 * one in is a config change rather than a rewrite. Nothing here pretends to
 * have sent a message it did not send.
 */

export type EmailMessage = {
  to: string;
  subject: string;
  text: string;
  html?: string;
};

export type SmsMessage = {
  to: string;
  text: string;
};

export type DeliveryResult = {
  delivered: boolean;
  provider: string;
  reference?: string;
  error?: string;
};

export interface EmailProvider {
  readonly name: string;
  send(message: EmailMessage): Promise<DeliveryResult>;
}

export interface SmsProvider {
  readonly name: string;
  send(message: SmsMessage): Promise<DeliveryResult>;
}

class ConsoleEmailProvider implements EmailProvider {
  readonly name = 'console';
  async send(message: EmailMessage): Promise<DeliveryResult> {
    logger.info('email dispatched', {
      provider: this.name,
      to: message.to,
      subject: message.subject,
      // In development the whole body is written out: a truncated preview
      // hides the reset link, which makes the flow impossible to test without
      // a real mailbox. In production only a short preview is kept, so inbox
      // contents do not accumulate in log storage.
      ...(isProd
        ? { preview: message.text.slice(0, 120) }
        : { body: `\n${message.text}\n` }),
    });
    return { delivered: true, provider: this.name };
  }
}

class ConsoleSmsProvider implements SmsProvider {
  readonly name = 'console';
  async send(message: SmsMessage): Promise<DeliveryResult> {
    logger.info('sms dispatched', {
      provider: this.name,
      to: message.to,
      preview: message.text.slice(0, 160),
    });
    return { delivered: true, provider: this.name };
  }
}

/**
 * SMTP is declared but not wired to a library: adding nodemailer for a feature
 * nobody can configure yet would be a dependency without a user. The driver
 * refuses loudly rather than silently dropping mail.
 */
class SmtpEmailProvider implements EmailProvider {
  readonly name = 'smtp';
  async send(message: EmailMessage): Promise<DeliveryResult> {
    if (!env.SMTP_URL) {
      return { delivered: false, provider: this.name, error: 'SMTP_URL is not configured' };
    }
    logger.error('smtp provider not implemented', { to: message.to });
    return {
      delivered: false,
      provider: this.name,
      error: 'SMTP transport is not implemented yet — set EMAIL_DRIVER=console',
    };
  }
}

export const emailProvider: EmailProvider =
  env.EMAIL_DRIVER === 'smtp' ? new SmtpEmailProvider() : new ConsoleEmailProvider();

export const smsProvider: SmsProvider = new ConsoleSmsProvider();
